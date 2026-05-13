import { urlAtom } from "@/lib/states";
import { useAtomValue } from "jotai";
import { useState } from "react";
import {
  ImageQrGenerationOptions,
  ImageQrGenerateRequest,
  ImageQrGenerateResponse,
} from "@/lib/image_qr/types";

export type ImageQrUiStatus =
  | "idle"
  | "requesting"
  | "generating"
  | "verifying_scan"
  | "completed"
  | "failed";

export default function useGenQrImage() {
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<ImageQrUiStatus>("idle");
  const [resData, setResData] = useState<ImageQrGenerateResponse | null>(null);
  const url = useAtomValue(urlAtom) || "https://qrbtf.com";

  async function onSubmit(values: Omit<ImageQrGenerateRequest, "url" | "options"> & ImageQrGenerationOptions) {
    setGenerating(true);
    setStatus("requesting");
    setResData(null);

    try {
      const { sourceImage, prompt, negativePrompt, ...options } = values;
      setStatus("generating");
      const response = await fetch("/api/image-qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          sourceImage,
          prompt,
          negativePrompt,
          options,
        }),
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
