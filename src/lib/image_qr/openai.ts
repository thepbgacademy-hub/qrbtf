import OpenAI from "openai";
import { toFile } from "openai/uploads";
import type { ImageQrGenerateRequest } from "./types";

const SUPPORTED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type SupportedImageType = keyof typeof SUPPORTED_IMAGE_TYPES;

function dataUrlToImage(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Image input must be a PNG, JPEG, or WebP data URL.");
  }

  const mimeType = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
  const type = mimeType as SupportedImageType;
  return {
    buffer: Buffer.from(match[2], "base64"),
    extension: SUPPORTED_IMAGE_TYPES[type],
    type,
  };
}

function generationPrompt(request: ImageQrGenerateRequest) {
  const seed =
    request.options.seed >= 0
      ? `Use seed ${request.options.seed} as a consistency hint.`
      : "";

  return [
    "Create a square hidden-art QR code image.",
    "Use the first image as the source artwork and preserve its main subject, composition, color mood, and realism.",
    "Use the second image as a subtle PNG QR structure guide. Blend that structure into natural image features such as shadows, fabric folds, ornaments, highlights, architectural edges, smoke, ribbons, or texture.",
    "The final image must be artwork first and QR code second, while keeping the QR guide scannable.",
    `Art direction: ${request.prompt}`,
    request.negativePrompt ? `Avoid: ${request.negativePrompt}` : "",
    `Hidden art blend: ${request.options.hiddenArtBlend}`,
    `Scan strictness: ${request.options.scanStrictness}`,
    `Anchor style: ${request.options.anchorStyle}`,
    seed,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateImageQrWithOpenAI(
  request: ImageQrGenerateRequest,
  guideDataUrl: string,
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const source = dataUrlToImage(request.sourceImage);
  const guide = dataUrlToImage(guideDataUrl);
  const sourceFile = await toFile(source.buffer, `source.${source.extension}`, {
    type: source.type,
  });
  const guideFile = await toFile(guide.buffer, "qr-guide.png", {
    type: "image/png",
  });

  const response = await openai.images.edit({
    model: "gpt-image-1.5",
    image: [sourceFile, guideFile],
    prompt: generationPrompt(request),
    size: request.options.size,
    quality: "medium",
    input_fidelity: "high",
    output_format: "png",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI did not return image data.");
  }

  return `data:image/png;base64,${b64}`;
}
