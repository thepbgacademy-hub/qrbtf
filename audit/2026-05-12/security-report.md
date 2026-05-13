# Security Review Report

**Date:** 2026-05-12  
**Branch:** `codex/qr-image-generator-engine`  
**Repository:** `thepbgacademy-hub/qrbtf`  
**Scope:** Full working tree with focus on the new Image QR generation endpoint, OpenAI image workflow, client upload flow, configuration, dependencies, and secret exposure.

## Executive Summary

The new Image QR implementation is structurally reasonable: server-side OpenAI calls keep the API key out of the browser, input validation constrains URL/prompt/image payload shape and size, and generation is session-gated by default. No real secrets were found in the current tree or targeted git history scan.

The largest current risk is dependency exposure: `next@14.2.35` is reported by `yarn audit` as affected by multiple public advisories, including high-severity denial-of-service issues in App Router / Server Components. The new image generation API also needs rate limiting and safer error handling before production use because it can consume paid OpenAI image-generation capacity.

**Overall Risk Rating:** Moderate  
**Risk Score:** 25  
**Severity Counts:** Critical 0, High 1, Medium 4, Low 1

## Methodology

- Reviewed source, config, package manifests, and generated branch changes.
- Mapped findings against OWASP Top 10 2021 categories A01-A10.
- Ran dependency audit with `corepack yarn audit --groups dependencies --json`.
- Ran required secret scan over the current tree and targeted git history.
- Reviewed the new server route at `src/app/api/image-qr/generate/route.ts`, OpenAI wrapper, QR verification helpers, and relevant Next.js configuration.

## Findings

### QRSEC-001 - High - A03 Vulnerable and Outdated Components: Next.js Runtime Advisories

**Evidence**

- `package.json:70` pins `next` to `14.2.35`.
- `corepack yarn audit --groups dependencies --json` reported multiple advisories against this version of `next`, including high-severity App Router / React Server Components denial-of-service issues and moderate XSS/cache/image optimizer issues.
- Reported examples include `GHSA-h25m-26qc-wcjf`, `GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj`, `GHSA-ffhc-5mcf-pf4q`, `GHSA-gx5p-jg67-6x7h`, `GHSA-h64f-5h5j-jqjh`, `GHSA-ggv3-7p47-pfv8`, and others.

**Impact**

Unpatched Next.js runtime vulnerabilities can allow denial of service and, under specific App Router/CSP/script usage conditions, browser-side impact. This is the highest-priority issue because it affects core framework request handling rather than only the new feature.

**Recommendation**

Plan and test an upgrade to a patched Next.js line. The audit output identifies `>=15.5.16` and `>=16.2.5` as patch targets for the newest advisories. Because this app is on Next 14, do the upgrade in a dedicated dependency branch and run a full build, route smoke test, and QR generation regression test. If upgrade cannot happen immediately, deploy behind platform/WAF protections, block suspicious RSC requests where possible, and review use of rewrites and image optimization.

**CWE:** CWE-937, CWE-400, CWE-770, CWE-79

### QRSEC-002 - Medium - A06 Vulnerable and Outdated Components / Resource Management: No Rate Limit on Paid Generation Endpoint

**Evidence**

- `src/app/api/image-qr/generate/route.ts:55-120` accepts generation requests and calls OpenAI through `generateImageQrWithOpenAI`.
- `src/app/api/image-qr/generate/route.ts:58-73` requires an active session by default, but there is no per-user, per-IP, or global rate limit before image generation.

**Impact**

An authenticated user, stolen session, or intentionally disabled local session gate (`IMAGE_QR_REQUIRE_SESSION=false`) can repeatedly trigger expensive image-generation requests. This creates cost-amplification and availability risk.

**Recommendation**

Add a small, explicit limiter before the OpenAI call. Minimum viable control: per-session and per-IP rolling-window limits with a clear 429 response. Production controls should include daily quota, maximum concurrent generations per account, and server-side telemetry for failure/success/cost.

**CWE:** CWE-799, CWE-770

### QRSEC-003 - Medium - A10 Server-Side Request Forgery / A09 Logging and Monitoring: Internal Error Details Returned to Client

**Evidence**

- `src/app/api/image-qr/generate/route.ts:118` returns `error instanceof Error ? error.message : "Image QR generation failed."` to the browser on generation failure.

**Impact**

OpenAI SDK errors, network failures, or internal validation failures may expose provider messages, operational details, or environment/configuration clues. This is also weaker for monitoring because detailed errors are not captured in a controlled server-side log path.

**Recommendation**

Return a stable generic client error such as `Image QR generation failed. Please try again.` Log the detailed error server-side with request metadata that does not include raw image data, prompts, or secrets. Consider a request ID in the client response for support/debugging.

**CWE:** CWE-209

### QRSEC-004 - Medium - A02 Cryptographic Failures / Security Misconfiguration: Missing Security Headers

**Evidence**

- `next.config.mjs:11-55` does not define security headers.
- `src/lib/layout_data.tsx:74-89` manually emits a `<head>` with external script loading, but no Content Security Policy is configured.

**Impact**

Without baseline headers, browsers do not get defense-in-depth controls such as Content Security Policy, HSTS, X-Content-Type-Options, clickjacking protections, Referrer-Policy, or Permissions-Policy. This raises the impact of any future XSS or third-party script issue.

**Recommendation**

Add a conservative `headers()` configuration in `next.config.mjs`. Suggested baseline: `Content-Security-Policy`, `Strict-Transport-Security` for HTTPS production, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` or equivalent CSP `frame-ancestors`, `Referrer-Policy`, and `Permissions-Policy`. CSP must account for required Google Ads and Mixpanel domains if those remain.

**CWE:** CWE-693, CWE-16

### QRSEC-005 - Medium - A08 Software and Data Integrity Failures: Third-Party Script Runs in Main Origin

**Evidence**

- `src/lib/layout_data.tsx:86-87` loads `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?...` directly in the page.
- `next.config.mjs:13-33` rewrites Mixpanel paths to external services.

**Impact**

Third-party JavaScript runs with the page's origin privileges. If a third-party script, account, CDN path, or injected ad path is compromised, users can be exposed. SRI is often impractical for dynamic ad scripts, which makes CSP and strict vendor governance more important.

**Recommendation**

Keep only required third-party scripts, document the business need, and enforce a CSP that limits script, connect, frame, and image destinations. If ads are unnecessary for the internal QR generator, disable them for authenticated app routes and generation pages.

**CWE:** CWE-829

### QRSEC-006 - Low - A09 Security Logging and Monitoring Failures: Generation Security Events Are Not Logged

**Evidence**

- `src/app/api/image-qr/generate/route.ts:60-72` returns 401 for missing session without logging.
- `src/app/api/image-qr/generate/route.ts:81-94` returns 400 for validation failures without logging.
- `src/app/api/image-qr/generate/route.ts:108-120` returns 500 for generation failure without structured logging.

**Impact**

Abuse attempts, repeated invalid uploads, quota pressure, and OpenAI/provider failures will be harder to detect and investigate.

**Recommendation**

Add structured server-side event logging for denied generation, validation failure, rate-limit hit, generation failure, and scan failure. Avoid logging uploaded image data, raw secrets, full cookies, or sensitive prompts. Include request IDs and normalized failure reasons.

**CWE:** CWE-778

## OWASP Category Coverage

- **A01 Broken Access Control:** Reviewed. The new endpoint is session-gated by default through `IMAGE_QR_REQUIRE_SESSION !== "false"`. No direct access-control bypass found in scope.
- **A02 Cryptographic Failures:** Missing security headers/CSP noted in QRSEC-004.
- **A03 Injection:** Reviewed request validation, dynamic fetches, and rendering. No SQL, shell execution, `eval`, or `dangerouslySetInnerHTML` issue found in the new feature. Dependency advisories are captured under QRSEC-001.
- **A04 Insecure Design:** Reviewed. The main design concern is cost/resource abuse, captured under QRSEC-002.
- **A05 Security Misconfiguration:** Missing hardening headers captured under QRSEC-004.
- **A06 Vulnerable and Outdated Components:** Dependency advisories and rate/resource concerns captured under QRSEC-001 and QRSEC-002.
- **A07 Identification and Authentication Failures:** Reviewed delegated session check. No hardcoded credentials or obvious auth bypass found, though cookie security flags are controlled outside this repository.
- **A08 Software and Data Integrity Failures:** Third-party script and analytics rewrites captured under QRSEC-005.
- **A09 Security Logging and Monitoring Failures:** Logging gaps captured under QRSEC-006.
- **A10 Server-Side Request Forgery:** The new generation route does not fetch user-provided URLs server-side. Error disclosure in the server boundary is captured under QRSEC-003.

## Secret Scan Results

**Result:** No exposed secrets found.

Current-tree and targeted git-history scans found only placeholders, environment variable names, and code references:

- `.env.example:4` contains `OPENAI_API_KEY=` with no value.
- `docs/superpowers/plans/2026-05-12-image-qr-generator.md` documents `OPENAI_API_KEY=` and one placeholder value `<local key>`.
- Source references such as `process.env.OPENAI_API_KEY` are expected and not secrets.

Targeted git history matches were limited to commits that introduced these placeholders and environment-variable names:

- `47e57f5 chore: add image qr generation dependencies`
- `65ca20c feat: add image qr generator`
- `d080225 docs: add image qr implementation plan`

## Recommended Remediation Order

1. Upgrade Next.js to a patched line and re-run `corepack yarn audit --groups dependencies --json`.
2. Add rate limiting and quota controls to `/api/image-qr/generate`.
3. Replace client-visible internal errors with generic messages and add server-side structured logging.
4. Add baseline security headers and a CSP compatible with required vendors.
5. Reassess whether ads and analytics rewrites should load on authenticated/generator routes.

## Verification Commands

```powershell
corepack yarn lint
corepack yarn build
corepack yarn audit --groups dependencies --json
rg -n -i --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!dist/**' --glob '!build/**' --glob '!.next/**' --glob '!yarn.lock' "(api[_-]?key|secret|token|password|passwd|pwd|credential|private[_-]?key|client[_-]?secret|service[_-]?role|webhook[_-]?secret|signing[_-]?secret|database[_-]?url|connection[_-]?string|bearer|authorization)" .
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!.next/**' --glob '!yarn.lock' "sk-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]+|rk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----|postgres(ql)?://[^\s]+:[^\s]+@" .
git log --all -G "sk_live_|SUPABASE_SERVICE_ROLE_KEY|BEGIN PRIVATE KEY|ghp_|github_pat_|whsec_|OPENAI_API_KEY|AKIA[0-9A-Z]{16}" --oneline -- . ':!yarn.lock'
```
