import { NextResponse } from "next/server";
import { z } from "zod";
import { renderQrGuidePngDataUrl } from "@/lib/image_qr/guide";
import { generateImageQrWithOpenAI } from "@/lib/image_qr/openai";
import { getServerSession } from "@/lib/latentcat-auth/server";
import type {
  ImageQrGenerateRequest,
  ImageQrGenerateResponse,
} from "@/lib/image_qr/types";
import { verifyGeneratedQrPng } from "@/lib/image_qr/verify";

export const runtime = "nodejs";

const MAX_SOURCE_IMAGE_BYTES = Number(
  process.env.IMAGE_QR_MAX_SOURCE_IMAGE_BYTES || 4 * 1024 * 1024,
);
const REQUIRE_SESSION = process.env.IMAGE_QR_REQUIRE_SESSION !== "false";
const supportedImageDataUrl =
  /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i;

function decodedBase64Bytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf("base64,") + "base64,".length);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

const requestSchema = z.object({
  url: z.string().min(1).max(300),
  sourceImage: z.string().regex(supportedImageDataUrl),
  prompt: z.string().min(1).max(1200),
  negativePrompt: z.string().max(1200).default(""),
  options: z.object({
    hiddenArtBlend: z.number().min(0).max(1),
    scanStrictness: z.number().min(0).max(1),
    seedHint: z.number(),
    size: z.enum(["1024x1024"]),
    paddingRatio: z.number().min(0).max(0.4),
    correctLevel: z.enum(["7", "15", "25", "30"]),
    anchorStyle: z.enum(["minimal", "square", "circle", "blended"]),
  }),
});

export async function POST(req: Request) {
  let parsed: ImageQrGenerateRequest;

  if (REQUIRE_SESSION) {
    const session = await getServerSession();
    if (!session) {
      const response: ImageQrGenerateResponse = {
        status: "failed",
        imageDataUrl: null,
        scan: {
          status: "skipped",
          decodedText: null,
          expectedText: "",
          message: "Sign in is required to generate image QR codes.",
        },
        error: "Sign in is required to generate image QR codes.",
      };
      return NextResponse.json(response, { status: 401 });
    }
  }

  try {
    parsed = requestSchema.parse(await req.json());
    if (decodedBase64Bytes(parsed.sourceImage) > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error("Source image is too large.");
    }
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
      error:
        "Please provide a URL, supported source image, prompt, and valid generation settings.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  try {
    const guide = renderQrGuidePngDataUrl(parsed.url, parsed.options);
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
