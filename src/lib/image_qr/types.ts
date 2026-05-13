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
