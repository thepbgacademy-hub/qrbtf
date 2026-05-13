import jsQR from "jsqr";
import { PNG } from "pngjs";
import type { ImageQrScanResult } from "./types";

function stripDataUrl(dataUrl: string) {
  const marker = "base64,";
  const index = dataUrl.indexOf(marker);
  return index >= 0 ? dataUrl.slice(index + marker.length) : dataUrl;
}

export function verifyGeneratedQrPng(
  imageDataUrl: string | null,
  expectedText: string,
): ImageQrScanResult {
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
    const result = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );

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
      message: passed
        ? "Scan passed."
        : "Scanner decoded a different payload.",
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
