import { urlAtom } from "@/lib/states";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { toast } from "sonner";
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
  const url = useAtomValue(urlAtom);

  async function onSubmit(values: Omit<ImageQrGenerateRequest, "url" | "options"> & ImageQrGenerationOptions) {
    setGenerating(true);
    setStatus("requesting");
    setResData(null);

    try {
      const { sourceImage, prompt, negativePrompt, ...options } = values;
      if (!url) {
        toast.error("Please enter a URL or text to encode.");
        setStatus("failed");
        return;
      }
      if (!sourceImage) {
        toast.error("Please upload a source image.");
        setStatus("failed");
        return;
      }
      if (!prompt.trim()) {
        toast.error("Please enter an art prompt.");
        setStatus("failed");
        return;
      }
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
      if (!response.ok && data.error) {
        toast.error(data.error);
      }
      setStatus(data.status === "completed" ? "completed" : "failed");
    } catch {
      setResData({
        status: "failed",
        imageDataUrl: null,
        scan: {
          status: "skipped",
          decodedText: null,
          expectedText: url || "",
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
