# Image QR Generator Design

## Goal

Build a user-facing Image QR Generator inside the QRBTF app that turns a user-uploaded image into a hidden-art QR code. The first version optimizes for visual disguise and artistic blend, while still reporting whether the generated result scans.

## Product Direction

This feature is our own first-party engine design, based on QRBTF's app patterns rather than QRBTF's private AI backend. We will use the existing Next.js app, route structure, form controls, and QR matrix utilities as the foundation. We will not depend on QRBTF's `/qrcode/gen_image` service, a third-party CLI, or a separate external project.

The v1 experience should feel like a creative tool:

- The user enters the QR payload through the existing URL/text input.
- The user uploads a source image.
- The user adds art direction in a prompt.
- The backend generates one art QR candidate.
- The app displays the final image and scan status.
- A failed scan can still be viewed and downloaded because hidden-art quality is the primary v1 goal.

## QRBTF Layout Alignment

The UI should follow the original QRBTF `/en` generation layout closely. We are adding a new image-based art QR style, not inventing a separate dashboard or account workflow.

The page structure should remain:

1. Top hero/header area with the QR payload URL/text input and scan action.
2. Horizontal style selector.
3. Main style generator section.
4. Left column for style controls.
5. Right column for the generate action, output preview, scan status, and download action.

The control set should adapt QRBTF's G1 art QR controls to our uploaded-image workflow:

- Source image upload, required for v1.
- Prompt, required.
- Negative prompt, optional.
- Seed.
- Hidden Art Blend, replacing or renaming QRBTF's control strength for this style. Higher values should preserve the uploaded image and hide QR structure more aggressively.
- QR Visibility or Scan Strictness, secondary. This lets the user trade hidden-art quality for easier scanning when needed.
- Size, square output by default.
- Padding ratio.
- Correct level, secondary and explained as more visible when higher.
- Anchor style, defaulting to minimal or blended.

Output behavior should mirror QRBTF's right-side output panel:

- The generate button remains near the output preview.
- Generation progress overlays the output square.
- The final art QR appears in the output square.
- Scan status appears as result metadata, not as a separate dashboard card.
- Download remains attached to the output panel.

## Scope

### In Scope

- Add a new user-facing QR style, likely `/[locale]/style/image`.
- Reuse the existing QRBTF generator surface: left-side controls and right-side output.
- Add a dedicated image QR module instead of modifying `g1`.
- Add a dedicated generation hook with richer task states.
- Add a backend endpoint that owns QR guide creation, OpenAI image generation, and scan verification.
- Display scan status as metadata attached to the generated image.
- Support manual build-time testing of generated candidates before adding automated retry loops.

### Out of Scope

- User galleries.
- Batch generation.
- Billing, credits, or account limits.
- Training custom image models.
- Depending on QRBTF's private AI backend.
- Installing an unrelated QR-art CLI.
- Fully automated repair/retry loops in v1.

## Architecture

The feature is split into five small units.

### 1. Frontend QR Style Module

Create a new QR style module under `src/lib/qrbtf_lib/qrcodes/`. It follows QRBTF's existing `api_fetcher` pattern but uses our own image-specific hook and visualizer.

Responsibilities:

- Define the image QR module type.
- Define presets and controls.
- Render the result visualizer.
- Keep form state local through the existing `QrcodeGenerator` pattern.

### 2. Frontend Generator Surface

Use the existing QRBTF split layout instead of a separate account/dashboard page. This keeps the feature discoverable with other QR styles and avoids new navigation complexity.

Controls:

- Source image upload, required for v1.
- Prompt, required.
- Negative prompt, optional.
- Seed.
- Hidden Art Blend, default high for stronger visual disguise.
- QR Visibility or Scan Strictness, default low-to-medium.
- Size, default square.
- Padding ratio.
- Correct level.
- Anchor style, default minimal or blended.

Output:

- Generation progress overlay.
- Final image.
- Scan status: pending, passed, failed, or needs retry.
- Download action.

### 3. Backend Generation Endpoint

Add a first-party endpoint such as `POST /api/image-qr/generate`. It should not call QRBTF's private API.

Responsibilities:

- Validate payload, source image, and prompt.
- Generate a QR matrix from the submitted URL/text.
- Render a soft QR guide image from the matrix.
- Call OpenAI image generation/editing with the source image and QR guide.
- Run one scan verification pass on the returned image.
- Return image URL/data plus scan metadata.

For v1, this endpoint can run synchronously if response times are acceptable during development. If image generation is too slow or the hosting platform requires it, move to a task-and-poll shape that mirrors QRBTF's existing `g1` flow.

### 4. QR Guide Renderer

Create a deterministic guide renderer that converts the QR matrix into an image-generation reference.

The guide should be subtle enough to help hidden-art generation:

- Finder patterns are preserved but softened.
- Data modules are represented as blurred or grayscale regions.
- Padding is configurable.
- The guide remains square and aligned with the target output size.

This guide is not the final user image. It is an internal control image for OpenAI.

### 5. Scan Verification

Add a simple scan verification pass after generation.

Responsibilities:

- Attempt to decode the generated image.
- Compare decoded content to the submitted payload.
- Return status and decoded value if available.
- Avoid blocking download when scan fails.

Verification is informational in v1. The user should see the result even when the scan fails.

## Data Flow

1. User enters payload in the existing URL/text input.
2. User uploads source image and sets prompt/options.
3. Frontend submits payload, image, prompt, and options to our backend.
4. Backend creates QR matrix.
5. Backend renders QR guide image.
6. Backend sends source image, QR guide, and prompt to OpenAI image generation/editing.
7. Backend verifies the returned image with a scanner.
8. Frontend displays the image and scan status.
9. User can download or manually retry with adjusted settings.

## Default V1 Behavior

The defaults should favor hidden-art quality:

- Strong source-image preservation.
- High art blend.
- Low visible QR contrast.
- Minimal or blended finder patterns.
- Moderate padding.
- One output per click.
- Failed scan results remain visible and downloadable with a warning.

## Error Handling

Frontend errors:

- Missing image: show an inline form error.
- Missing prompt: show an inline form error.
- Missing URL/text: reuse existing URL validation behavior.
- Generation failure: show a non-destructive error state in the output panel.

Backend errors:

- Invalid image or unsupported file type: return a clear validation error.
- OpenAI generation failure: return failed status with a short message.
- Scan failure: return completed result with `scanStatus: "failed"` rather than treating it as a generation error.

## Testing Strategy

V1 should be tested manually during implementation and lightly automated where stable.

Manual checkpoints:

- Upload a real portrait or illustration.
- Generate a hidden-art QR for a short URL.
- Confirm the result keeps the source image recognizable.
- Test the output with at least one scanner.
- Adjust defaults if every result looks too obviously like a QR code.

Automated checks:

- Unit test QR guide generation for stable dimensions and matrix alignment.
- Unit test request validation.
- Unit test scan-status interpretation with known pass/fail fixtures if fixtures are practical.

## Likely Files

Create:

- `src/app/[locale]/(qrcodes)/style/image/page.tsx`
- `src/lib/qrbtf_lib/qrcodes/image.tsx`
- `src/lib/qrbtf_lib/qrcodes/image_config.ts`
- `src/lib/qrbtf_lib/qrcodes/hooks/use_gen_qr_image.ts`
- `src/components/QrcodeImageStatus.tsx`
- `src/app/api/image-qr/generate/route.ts`
- `src/lib/image_qr/guide.ts`
- `src/lib/image_qr/verify.ts`
- `src/lib/image_qr/openai.ts`

Modify:

- `src/lib/qr_style_list.ts`
- `messages/en.json`
- `messages/zh.json`
- `messages/jp.json`
- `public/assets/qrcodes/` for a new style thumbnail
- Possibly `src/components/QrcodeGenerator.tsx` if the current `api_fetcher.visualizer({ data })` slot needs scan metadata or custom output actions.

## Implementation Decisions For V1

- Start with a synchronous backend route. Switch to task-and-poll only if local manual testing proves image generation timeouts are a real blocker.
- Use the simplest scanner library that works in the selected server/runtime environment.
- Return generated images as base64 data URLs during v1. Add object storage only after the core generation and scan loop works.
