import { NextResponse } from "next/server";
import { z } from "zod";
import { renderQrGuidePngDataUrl } from "@/lib/image_qr/guide";
import { generateImageQrWithOpenAI } from "@/lib/image_qr/openai";
import type {
  ImageQrGenerateRequest,
  ImageQrGenerateResponse,
} from "@/lib/image_qr/types";
import { verifyGeneratedQrPng } from "@/lib/image_qr/verify";

export const runtime = "nodejs";

const supportedImageDataUrl =
  /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i;

const requestSchema = z.object({
  url: z.string().min(1).max(300),
  sourceImage: z.string().regex(supportedImageDataUrl),
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
