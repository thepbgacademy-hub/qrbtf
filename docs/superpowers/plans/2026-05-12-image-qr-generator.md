# Image QR Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user-facing QRBTF image-art QR generator that accepts an uploaded source image, embeds a QR payload as hidden artwork using OpenAI image generation, and reports scan status.

**Architecture:** Add a new QRBTF style page that follows the existing `/en` generator layout. Keep the frontend thin: collect controls, submit to a first-party API route, render progress, show the generated image, and display scan metadata. Put deterministic QR guide rendering, OpenAI image editing, and scan verification behind focused server utilities.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, existing QRBTF `@paulmillr/qr` encoder wrapper, OpenAI Node SDK, `pngjs` + `jsqr` for v1 PNG scan verification, existing shadcn/Radix controls, existing `react-hook-form` generator pattern.

---

## References

- Design spec: `docs/superpowers/specs/2026-05-10-image-qr-generator-design.md`
- OpenAI image generation guide: https://platform.openai.com/docs/guides/image-generation
- OpenAI Images API reference: https://platform.openai.com/docs/api-reference/images/overview
- Existing generator shell: `src/components/QrcodeGenerator.tsx`
- Existing AI fetch hook: `src/lib/qrbtf_lib/qrcodes/hooks/use_gen_ai_image.ts`
- Existing G1 config: `src/lib/qrbtf_lib/qrcodes/g1_config.ts`
- Existing style route pattern: `src/app/[locale]/(qrcodes)/style/c2/page.tsx`

## File Structure

Create:

- `src/lib/image_qr/types.ts`: shared request, response, option, and scan-status types.
- `src/lib/image_qr/guide.ts`: deterministic SVG data URL QR guide renderer.
- `src/lib/image_qr/verify.ts`: PNG base64 QR decode and payload comparison.
- `src/lib/image_qr/openai.ts`: OpenAI image edit wrapper.
- `src/app/api/image-qr/generate/route.ts`: first-party generation endpoint.
- `src/lib/qrbtf_lib/qrcodes/hooks/use_gen_qr_image.ts`: frontend hook for image QR generation.
- `src/lib/qrbtf_lib/qrcodes/image.tsx`: `api_fetcher` module and visualizer.
- `src/lib/qrbtf_lib/qrcodes/image_config.ts`: defaults and controls.
- `src/app/[locale]/(qrcodes)/style/image/page.tsx`: route for the new style.
- `src/components/QrcodeImageStatus.tsx`: compact result metadata/status display.
- `public/assets/qrcodes/image.svg`: simple temporary style thumbnail made from QRBTF-like SVG shapes.

Modify:

- `package.json` and `yarn.lock`: add `openai`, `jsqr`, and `pngjs`.
- `src/lib/qr_style_list.ts`: add the image style to the style carousel.
- `messages/en.json`: add `qrcodes.image` copy.
- `messages/zh.json`: add English fallback copy under `qrcodes.image` for build stability.
- `messages/jp.json`: add English fallback copy under `qrcodes.image` for build stability.
- `src/components/QrcodeGenerator.tsx`: only if needed to pass richer result metadata into the visualizer; prefer avoiding this change by keeping the existing `api_fetcher.visualizer({ data })` contract.

---

### Task 1: Add Dependencies And Environment Contract

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock`
- Create: `.env.example` if the repo does not already have one

- [ ] **Step 1: Add runtime dependencies**

Run:

```bash
yarn add openai jsqr pngjs
```

Expected: `package.json` and `yarn.lock` include the new packages.

- [ ] **Step 2: Add the local environment example**

If `.env.example` does not exist, create it with:

```dotenv
NEXT_PUBLIC_ACCOUNT_URL=
NEXT_PUBLIC_CLIENT_ID=
NEXT_PUBLIC_QRBTF_API_ENDPOINT=
OPENAI_API_KEY=
```

If `.env.example` exists, add only:

```dotenv
OPENAI_API_KEY=
```

- [ ] **Step 3: Verify dependency install**

Run:

```bash
yarn lint
```

Expected: lint completes with zero warnings, or fails only on pre-existing files unrelated to dependency installation. Record any unrelated pre-existing lint failures in the task notes before continuing.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock .env.example
git commit -m "chore: add image qr generation dependencies"
```

---

### Task 2: Define Shared Image QR Types

**Files:**
- Create: `src/lib/image_qr/types.ts`

- [ ] **Step 1: Create shared types**

Create `src/lib/image_qr/types.ts`:

```ts
export type ImageQrScanStatus = "pending" | "passed" | "failed" | "skipped";

export interface ImageQrGenerationOptions {
  hiddenArtBlend: number;
  scanStrictness: number;
  seed: number;
  size: "1024x1024" | "1536x1536";
  paddingRatio: number;
  correctLevel: "7" | "15" | "25" | "30";
  anchorStyle: "minimal" | "square" | "circle" | "blended";
}

export interface ImageQrGenerateRequest {
  url: string;
  sourceImage: string;
  prompt: string;
  negativePrompt: string;
  options: ImageQrGenerationOptions;
}

export interface ImageQrScanResult {
  status: ImageQrScanStatus;
  decodedText: string | null;
  expectedText: string;
  message: string;
}

export interface ImageQrGenerateResponse {
  status: "completed" | "failed";
  imageDataUrl: string | null;
  scan: ImageQrScanResult;
  error: string | null;
}
```

- [ ] **Step 2: Run type check through build**

Run:

```bash
yarn build
```

Expected: build behavior is unchanged from baseline. If build fails because required public environment variables are missing, rerun with local dummy values:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/image_qr/types.ts
git commit -m "feat: add image qr shared types"
```

---

### Task 3: Build The Deterministic QR Guide Renderer

**Files:**
- Create: `src/lib/image_qr/guide.ts`

- [ ] **Step 1: Implement guide rendering**

Create `src/lib/image_qr/guide.ts`:

```ts
import { encode, QRPointType } from "@/lib/qrbtf_lib/encoder";
import { ImageQrGenerationOptions } from "./types";

const ECC_BY_PERCENT: Record<ImageQrGenerationOptions["correctLevel"], "low" | "medium" | "quartile" | "high"> = {
  "7": "low",
  "15": "medium",
  "25": "quartile",
  "30": "high",
};

function moduleOpacity(type: QRPointType, isDark: boolean, options: ImageQrGenerationOptions) {
  if (!isDark) return options.scanStrictness > 0.65 ? 0.12 : 0.06;
  if (type === QRPointType.POS_CENTER || type === QRPointType.POS_OTHER) {
    return options.anchorStyle === "minimal" || options.anchorStyle === "blended" ? 0.38 : 0.58;
  }
  if (type === QRPointType.TIMING || type === QRPointType.ALIGN_CENTER || type === QRPointType.ALIGN_OTHER) {
    return 0.3 + options.scanStrictness * 0.2;
  }
  return 0.18 + options.scanStrictness * 0.26;
}

export function renderQrGuideSvgDataUrl(payload: string, options: ImageQrGenerationOptions) {
  const [table, typeTable] = encode(payload, { ecc: ECC_BY_PERCENT[options.correctLevel] });
  const modules = table.length;
  const size = Number(options.size.split("x")[0]);
  const padding = Math.round(size * options.paddingRatio);
  const usable = size - padding * 2;
  const cell = usable / modules;

  const rects: string[] = [];
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      const isDark = table[x][y];
      const opacity = moduleOpacity(typeTable[x][y], isDark, options);
      const fill = isDark ? "#111111" : "#ffffff";
      rects.push(
        `<rect x="${padding + x * cell}" y="${padding + y * cell}" width="${cell + 0.4}" height="${cell + 0.4}" fill="${fill}" opacity="${opacity.toFixed(3)}" rx="${(cell * 0.18).toFixed(2)}"/>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#808080"/>${rects.join("")}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
```

- [ ] **Step 2: Verify import and type correctness**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: TypeScript accepts `renderQrGuideSvgDataUrl`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/image_qr/guide.ts
git commit -m "feat: add qr guide renderer"
```

---

### Task 4: Add PNG Scan Verification

**Files:**
- Create: `src/lib/image_qr/verify.ts`

- [ ] **Step 1: Implement generated PNG verification**

Create `src/lib/image_qr/verify.ts`:

```ts
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { ImageQrScanResult } from "./types";

function stripDataUrl(dataUrl: string) {
  const marker = "base64,";
  const index = dataUrl.indexOf(marker);
  return index >= 0 ? dataUrl.slice(index + marker.length) : dataUrl;
}

export function verifyGeneratedQrPng(imageDataUrl: string | null, expectedText: string): ImageQrScanResult {
  if (!imageDataUrl) {
    return {
      status: "failed",
      decodedText: null,
      expectedText,
      message: "No generated image was returned.",
    };
  }

  try {
    const png = PNG.sync.read(Buffer.from(stripDataUrl(imageDataUrl), "base64"));
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    if (!result?.data) {
      return {
        status: "failed",
        decodedText: null,
        expectedText,
        message: "Scanner did not detect a QR payload.",
      };
    }

    const passed = result.data === expectedText;
    return {
      status: passed ? "passed" : "failed",
      decodedText: result.data,
      expectedText,
      message: passed ? "Scan passed." : "Scanner decoded a different payload.",
    };
  } catch {
    return {
      status: "failed",
      decodedText: null,
      expectedText,
      message: "Generated image could not be decoded as PNG for verification.",
    };
  }
}
```

- [ ] **Step 2: Verify build**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: build passes or reveals missing TypeScript declarations for `pngjs`. If declarations are missing, run:

```bash
yarn add -D @types/pngjs
```

Then rerun the build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/image_qr/verify.ts package.json yarn.lock
git commit -m "feat: add image qr scan verification"
```

---

### Task 5: Add OpenAI Image Edit Client

**Files:**
- Create: `src/lib/image_qr/openai.ts`

- [ ] **Step 1: Implement OpenAI wrapper**

Create `src/lib/image_qr/openai.ts`:

```ts
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { ImageQrGenerateRequest } from "./types";

function base64ToBuffer(dataUrl: string) {
  const marker = "base64,";
  const index = dataUrl.indexOf(marker);
  const base64 = index >= 0 ? dataUrl.slice(index + marker.length) : dataUrl;
  return Buffer.from(base64, "base64");
}

function generationPrompt(request: ImageQrGenerateRequest, guideDataUrl: string) {
  return [
    "Create a square hidden-art QR code image.",
    "Use the first image as the source artwork and preserve its main subject, composition, color mood, and realism.",
    "Use the second image as a subtle QR structure guide. Blend the QR structure into natural image features such as shadows, fabric folds, ornaments, highlights, architectural edges, smoke, ribbons, or texture.",
    "The result should look like artwork first and QR code second.",
    `Art direction: ${request.prompt}`,
    request.negativePrompt ? `Avoid: ${request.negativePrompt}` : "",
    `Hidden art blend: ${request.options.hiddenArtBlend}`,
    `QR guide reference: ${guideDataUrl.slice(0, 80)}...`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateImageQrWithOpenAI(request: ImageQrGenerateRequest, guideDataUrl: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sourceFile = await toFile(base64ToBuffer(request.sourceImage), "source.png", { type: "image/png" });
  const guideFile = await toFile(base64ToBuffer(guideDataUrl), "qr-guide.svg", { type: "image/svg+xml" });

  const response = await openai.images.edit({
    model: "gpt-image-1.5",
    image: [sourceFile, guideFile],
    prompt: generationPrompt(request, guideDataUrl),
    size: request.options.size,
    quality: "medium",
    input_fidelity: "high",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI did not return image data.");
  }

  return `data:image/png;base64,${b64}`;
}
```

- [ ] **Step 2: Verify SDK type shape**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: TypeScript accepts `openai.images.edit`. If the installed SDK type expects `quality` or `input_fidelity` under different names, adjust only `src/lib/image_qr/openai.ts` to match the installed SDK. Keep the public `generateImageQrWithOpenAI(request, guideDataUrl)` signature unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/lib/image_qr/openai.ts
git commit -m "feat: add openai image qr client"
```

---

### Task 6: Add First-Party Generation API Route

**Files:**
- Create: `src/app/api/image-qr/generate/route.ts`

- [ ] **Step 1: Implement request validation and response flow**

Create `src/app/api/image-qr/generate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderQrGuideSvgDataUrl } from "@/lib/image_qr/guide";
import { generateImageQrWithOpenAI } from "@/lib/image_qr/openai";
import { verifyGeneratedQrPng } from "@/lib/image_qr/verify";
import { ImageQrGenerateRequest, ImageQrGenerateResponse } from "@/lib/image_qr/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  url: z.string().min(1).max(300),
  sourceImage: z.string().startsWith("data:image/"),
  prompt: z.string().min(1).max(1200),
  negativePrompt: z.string().max(1200).default(""),
  options: z.object({
    hiddenArtBlend: z.number().min(0).max(1),
    scanStrictness: z.number().min(0).max(1),
    seed: z.number(),
    size: z.enum(["1024x1024", "1536x1536"]),
    paddingRatio: z.number().min(0).max(0.5),
    correctLevel: z.enum(["7", "15", "25", "30"]),
    anchorStyle: z.enum(["minimal", "square", "circle", "blended"]),
  }),
});

export async function POST(req: Request) {
  let parsed: ImageQrGenerateRequest;

  try {
    parsed = requestSchema.parse(await req.json());
  } catch {
    const response: ImageQrGenerateResponse = {
      status: "failed",
      imageDataUrl: null,
      scan: {
        status: "skipped",
        decodedText: null,
        expectedText: "",
        message: "Request validation failed.",
      },
      error: "Please provide a URL, source image, prompt, and valid generation settings.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  try {
    const guide = renderQrGuideSvgDataUrl(parsed.url, parsed.options);
    const imageDataUrl = await generateImageQrWithOpenAI(parsed, guide);
    const scan = verifyGeneratedQrPng(imageDataUrl, parsed.url);
    const response: ImageQrGenerateResponse = {
      status: "completed",
      imageDataUrl,
      scan,
      error: null,
    };
    return NextResponse.json(response);
  } catch (error) {
    const response: ImageQrGenerateResponse = {
      status: "failed",
      imageDataUrl: null,
      scan: {
        status: "skipped",
        decodedText: null,
        expectedText: parsed.url,
        message: "Generation did not complete.",
      },
      error: error instanceof Error ? error.message : "Image QR generation failed.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: route compiles for Node runtime.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/image-qr/generate/route.ts
git commit -m "feat: add image qr generation api"
```

---

### Task 7: Add Frontend Generation Hook And Status Display

**Files:**
- Create: `src/lib/qrbtf_lib/qrcodes/hooks/use_gen_qr_image.ts`
- Create: `src/components/QrcodeImageStatus.tsx`

- [ ] **Step 1: Create generation hook**

Create `src/lib/qrbtf_lib/qrcodes/hooks/use_gen_qr_image.ts`:

```ts
import { urlAtom } from "@/lib/states";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { ImageQrGenerateRequest, ImageQrGenerateResponse } from "@/lib/image_qr/types";

export type ImageQrUiStatus = "idle" | "requesting" | "generating" | "verifying_scan" | "completed" | "failed";

export default function useGenQrImage() {
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<ImageQrUiStatus>("idle");
  const [resData, setResData] = useState<ImageQrGenerateResponse | null>(null);
  const url = useAtomValue(urlAtom) || "https://qrbtf.com";

  async function onSubmit(values: Omit<ImageQrGenerateRequest, "url">) {
    setGenerating(true);
    setStatus("requesting");
    setResData(null);

    try {
      setStatus("generating");
      const response = await fetch("/api/image-qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...values }),
      });
      setStatus("verifying_scan");
      const data = (await response.json()) as ImageQrGenerateResponse;
      setResData(data);
      setStatus(data.status === "completed" ? "completed" : "failed");
    } catch {
      setResData({
        status: "failed",
        imageDataUrl: null,
        scan: {
          status: "skipped",
          decodedText: null,
          expectedText: url,
          message: "Request failed before generation completed.",
        },
        error: "Image QR request failed.",
      });
      setStatus("failed");
    } finally {
      setGenerating(false);
    }
  }

  return { onSubmit, generating, status, resData };
}
```

- [ ] **Step 2: Create status component**

Create `src/components/QrcodeImageStatus.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ImageQrScanResult } from "@/lib/image_qr/types";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

export function QrcodeImageStatus(props: { scan: ImageQrScanResult | null; loading?: boolean }) {
  if (props.loading) {
    return (
      <Badge variant="outline" className="gap-1 rounded-md">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Generating
      </Badge>
    );
  }

  if (!props.scan) return null;

  const passed = props.scan.status === "passed";
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <Badge variant={passed ? "default" : "outline"} className="w-fit gap-1 rounded-md">
        {passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
        {passed ? "Scan passed" : "Needs retry"}
      </Badge>
      <span>{props.scan.message}</span>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/qrbtf_lib/qrcodes/hooks/use_gen_qr_image.ts src/components/QrcodeImageStatus.tsx
git commit -m "feat: add image qr frontend generation state"
```

---

### Task 8: Add Image QR Module, Config, And Route

**Files:**
- Create: `src/lib/qrbtf_lib/qrcodes/image.tsx`
- Create: `src/lib/qrbtf_lib/qrcodes/image_config.ts`
- Create: `src/app/[locale]/(qrcodes)/style/image/page.tsx`

- [ ] **Step 1: Create config**

Create `src/lib/qrbtf_lib/qrcodes/image_config.ts`:

```ts
import { useTranslations } from "next-intl";
import { CommonControlProps } from "./param";
import { QrbtfRendererImageProps } from "./image";

export type ImagePresetKeys = "image";

export const ImagePresets: Record<ImagePresetKeys, QrbtfRendererImageProps> = {
  image: {
    sourceImage: "",
    prompt: "",
    negativePrompt: "",
    seed: -1,
    hiddenArtBlend: 0.85,
    scanStrictness: 0.35,
    size: "1024x1024",
    paddingRatio: 0.2,
    correctLevel: "15",
    anchorStyle: "minimal",
  },
};

export function useImageParams() {
  const t = useTranslations("qrcodes.image");
  const params: CommonControlProps<QrbtfRendererImageProps>[] = [
    { type: "image", name: "sourceImage", label: t("sourceImage.label"), desc: t("sourceImage.desc"), config: { buttonLabel: t("sourceImage.button") } },
    { type: "prompt", name: "prompt", label: t("prompt.label"), desc: t("prompt.desc"), config: { placeholder: t("prompt.placeholder") } },
    { type: "text", name: "negativePrompt", label: t("negativePrompt.label"), desc: t("negativePrompt.desc"), config: { placeholder: t("negativePrompt.placeholder") } },
    { type: "number", name: "seed", label: t("seed.label"), desc: t("seed.desc"), config: { min: -1, max: 9999 } },
    { type: "number", name: "hiddenArtBlend", label: t("hiddenArtBlend.label"), desc: t("hiddenArtBlend.desc"), config: { min: 0, max: 1, step: 0.01 } },
    { type: "number", name: "scanStrictness", label: t("scanStrictness.label"), desc: t("scanStrictness.desc"), config: { min: 0, max: 1, step: 0.01 } },
    { type: "select", name: "size", label: t("size.label"), desc: t("size.desc"), config: { values: [{ value: "1024x1024", label: "1024px" }, { value: "1536x1536", label: "1536px" }] } },
    { type: "number", name: "paddingRatio", label: t("paddingRatio.label"), desc: t("paddingRatio.desc"), config: { min: 0, max: 0.5, step: 0.01 } },
    { type: "select", name: "correctLevel", label: t("correctLevel.label"), desc: t("correctLevel.desc"), config: { values: [{ value: "7", label: "7%" }, { value: "15", label: "15%" }, { value: "25", label: "25%" }, { value: "30", label: "30%" }] } },
    { type: "select", name: "anchorStyle", label: t("anchorStyle.label"), desc: t("anchorStyle.desc"), config: { values: [{ value: "minimal", label: t("anchorStyle.minimal") }, { value: "blended", label: t("anchorStyle.blended") }, { value: "square", label: t("anchorStyle.square") }, { value: "circle", label: t("anchorStyle.circle") }] } },
  ];
  return { params };
}
```

- [ ] **Step 2: Create module visualizer**

Create `src/lib/qrbtf_lib/qrcodes/image.tsx`:

```tsx
"use client";

import React from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { QrcodeImageStatus } from "@/components/QrcodeImageStatus";
import { QrbtfModule } from "./param";
import { ImagePresets } from "./image_config";
import { ImageQrGenerateResponse } from "@/lib/image_qr/types";

export interface QrbtfRendererImageProps {
  sourceImage: string;
  prompt: string;
  negativePrompt: string;
  seed: number;
  hiddenArtBlend: number;
  scanStrictness: number;
  size: "1024x1024" | "1536x1536";
  paddingRatio: number;
  correctLevel: "7" | "15" | "25" | "30";
  anchorStyle: "minimal" | "square" | "circle" | "blended";
}

function QrbtfVisualizerImage(props: { data: ImageQrGenerateResponse | null }) {
  const data = props.data;
  const loading = data === null;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-background">
      {!data?.imageDataUrl && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          {loading ? <Loader2 className="h-10 w-10 animate-spin opacity-30" /> : <PhotoIcon className="h-12 w-12 opacity-20" />}
          <QrcodeImageStatus scan={data?.scan ?? null} loading={loading} />
        </div>
      )}
      {data?.imageDataUrl && <img src={data.imageDataUrl} alt="" className="block h-full w-full object-cover" />}
      {data && (
        <div className="absolute bottom-3 left-3 right-3">
          <QrcodeImageStatus scan={data.scan} />
        </div>
      )}
    </div>
  );
}

export const qrbtfModuleImage: QrbtfModule<QrbtfRendererImageProps> = {
  type: "api_fetcher",
  visualizer: QrbtfVisualizerImage,
  presets: ImagePresets,
};
```

- [ ] **Step 3: Create route page**

Create `src/app/[locale]/(qrcodes)/style/image/page.tsx`:

```tsx
import { QrcodeGenerator } from "@/components/QrcodeGenerator";
import { qrbtfModuleImage } from "@/lib/qrbtf_lib/qrcodes/image";
import { useImageParams } from "@/lib/qrbtf_lib/qrcodes/image_config";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("qrcodes.image");
  const { params } = useImageParams();

  return (
    <QrcodeGenerator
      title={t("title")}
      label={t("label")}
      subtitle={t("subtitle")}
      desc={t("desc")}
      qrcodeModule={qrbtfModuleImage}
      params={params}
      defaultPreset="image"
    />
  );
}
```

- [ ] **Step 4: Wire hook into generator with minimal branching**

Modify `src/components/QrcodeGenerator.tsx` only if the current `api_fetcher` flow cannot call `useGenQrImage`. Keep the change small: branch by current style type or by a module property, and preserve existing G1 behavior.

The preferred change is to add an optional submit hook field to `QrbtfModuleApiFetcher` in `src/lib/qrbtf_lib/qrcodes/param/index.ts`:

```ts
export interface QrbtfModuleApiFetcher<P> {
  type: "api_fetcher";
  visualizer: (props: { data: any }) => React.ReactNode;
  useSubmit?: () => {
    onSubmit: (values: any) => Promise<void>;
    generating: boolean;
    resData: any;
  };
}
```

Then set `useSubmit: useGenQrImage` on `qrbtfModuleImage` and keep `useGenAiImage` as the default in `QrcodeGenerator.tsx`.

- [ ] **Step 5: Verify build**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: image style page compiles.

- [ ] **Step 6: Commit**

```bash
git add src/lib/qrbtf_lib/qrcodes/image.tsx src/lib/qrbtf_lib/qrcodes/image_config.ts "src/app/[locale]/(qrcodes)/style/image/page.tsx" src/lib/qrbtf_lib/qrcodes/param/index.ts src/components/QrcodeGenerator.tsx
git commit -m "feat: add image qr style module"
```

---

### Task 9: Add Carousel Entry, Thumbnail, And Translations

**Files:**
- Modify: `src/lib/qr_style_list.ts`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Modify: `messages/jp.json`
- Create: `public/assets/qrcodes/image.svg`

- [ ] **Step 1: Add style list entry**

Add this object near `g1` in `src/lib/qr_style_list.ts`:

```ts
{
  id: "image",
  image: "image.svg",
},
```

- [ ] **Step 2: Add thumbnail**

Create `public/assets/qrcodes/image.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <rect width="240" height="240" fill="#f7f7f5"/>
  <path d="M26 76c34-42 70-48 106-18 21 18 37 16 62-1 21-14 36-14 46 1v124H26z" fill="#d6d8d2"/>
  <path d="M25 72c29 9 45 28 49 58 3 22 20 35 52 39 29 3 50 13 64 30" fill="none" stroke="#111" stroke-width="14" stroke-linecap="round" opacity=".42"/>
  <path d="M52 48h42v42H52zM146 48h42v42h-42zM52 146h42v42H52z" fill="none" stroke="#111" stroke-width="10" opacity=".72"/>
  <path d="M66 62h14v14H66zM160 62h14v14h-14zM66 160h14v14H66z" fill="#111" opacity=".72"/>
  <path d="M114 76c22 18 26 52 8 76M128 116c22-17 43-19 64-6M104 178c24-22 50-30 80-20" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity=".92"/>
</svg>
```

- [ ] **Step 3: Add English translation block**

Add `qrcodes.image` to `messages/en.json` following the G1 structure:

```json
"image": {
  "title": "Image QR",
  "label": "New",
  "subtitle": "Hide a working QR code inside uploaded artwork.",
  "desc": "Upload a source image, describe the art direction, and generate an art-first QR candidate with scan feedback.",
  "sourceImage": { "label": "Source image", "desc": "Upload the artwork to transform.", "button": "Upload image" },
  "prompt": { "label": "Prompt", "desc": "Describe how the QR structure should blend into the image.", "placeholder": "white ribbons and silver ornaments woven through the scene" },
  "negativePrompt": { "label": "Negative prompt", "desc": "Elements to avoid.", "placeholder": "obvious QR squares, harsh grid, extra text" },
  "seed": { "label": "Seed", "desc": "Use -1 for a random seed." },
  "hiddenArtBlend": { "label": "Hidden Art Blend", "desc": "Higher values favor artwork-first results." },
  "scanStrictness": { "label": "Scan Strictness", "desc": "Higher values make the QR structure more visible." },
  "size": { "label": "Size", "desc": "Output image size." },
  "paddingRatio": { "label": "Padding ratio", "desc": "Quiet border around the QR structure." },
  "correctLevel": { "label": "Correct level", "desc": "Higher correction can improve scans but may reveal more structure." },
  "anchorStyle": { "label": "Anchor style", "desc": "How visible the QR finder anchors should be.", "minimal": "Minimal", "blended": "Blended", "square": "Square", "circle": "Circle" }
}
```

- [ ] **Step 4: Add fallback translation blocks**

Add the same `qrcodes.image` object to `messages/zh.json` and `messages/jp.json` using English text for v1. This keeps builds stable before localization.

- [ ] **Step 5: Verify build**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: all locales build without missing translation errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/qr_style_list.ts messages/en.json messages/zh.json messages/jp.json public/assets/qrcodes/image.svg
git commit -m "feat: register image qr style"
```

---

### Task 10: Manual End-To-End Test And Polish

**Files:**
- Modify files from earlier tasks only when manual testing reveals a concrete issue.

- [ ] **Step 1: Start the dev server**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; $env:OPENAI_API_KEY="<local key>"; yarn dev
```

Expected: app starts on `http://localhost:3000`.

- [ ] **Step 2: Open the image QR page**

Navigate to:

```text
http://localhost:3000/en/style/image
```

Expected: page uses the QRBTF layout: top URL input, style selector, left controls, right output panel.

- [ ] **Step 3: Run a hidden-art generation test**

Use:

```text
URL: https://qrbtf.com
Prompt: flowing white ribbons and silver ornaments woven naturally through the source image, artwork first, QR code hidden in shadows and highlights
Hidden Art Blend: 0.85
Scan Strictness: 0.35
Correct level: 15%
Anchor style: Minimal
```

Expected: one generated image appears in the output square. Scan status is displayed as passed or needs retry. A needs-retry result remains visible and downloadable.

- [ ] **Step 4: Adjust obvious visual issues**

Make only targeted fixes:

- If output panel looks empty during generation, improve `QrcodeImageStatus`.
- If controls feel unlike QRBTF G1, adjust labels/order in `image_config.ts`.
- If QR structure is too visible by default, reduce default `scanStrictness` to `0.25`.
- If scans always fail and the QR is invisible, raise default `scanStrictness` to `0.45`.

- [ ] **Step 5: Run final checks**

Run:

```bash
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn lint
$env:NEXT_PUBLIC_ACCOUNT_URL="http://localhost:3000"; $env:NEXT_PUBLIC_CLIENT_ID="local"; $env:NEXT_PUBLIC_QRBTF_API_ENDPOINT="http://localhost:3000"; yarn build
```

Expected: lint and build pass.

- [ ] **Step 6: Commit polish**

```bash
git add src components messages public package.json yarn.lock
git commit -m "fix: polish image qr generator"
```

---

## Self-Review

- Spec coverage: The plan covers QRBTF layout alignment, a first-party engine, uploaded source images, hidden-art defaults, OpenAI image generation, scan metadata, manual testing, and no external QR-art CLI.
- Placeholder scan: No implementation placeholders are intentionally left in the plan. Each task names files, commands, and expected results.
- Type consistency: Shared request/response types flow from `types.ts` to the API route, OpenAI wrapper, verifier, hook, and visualizer.
