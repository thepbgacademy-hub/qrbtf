"use client";

import React from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { QrcodeImageStatus } from "@/components/QrcodeImageStatus";
import { QrbtfModule } from "./param";
import { ImagePresets } from "./image_config";
import { ImageQrGenerateResponse } from "@/lib/image_qr/types";
import useGenQrImage from "./hooks/use_gen_qr_image";

export interface QrbtfRendererImageProps {
  sourceImage: string;
  prompt: string;
  negativePrompt: string;
  seedHint: number;
  hiddenArtBlend: number;
  scanStrictness: number;
  size: "1024x1024";
  paddingRatio: number;
  correctLevel: "7" | "15" | "25" | "30";
  anchorStyle: "minimal" | "square" | "circle" | "blended";
}

function QrbtfVisualizerImage(props: {
  data: ImageQrGenerateResponse | null;
  generating?: boolean;
}) {
  const data = props.data;
  const loading = props.generating === true;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-background">
      {!data?.imageDataUrl && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          {loading ? (
            <Loader2 className="h-10 w-10 animate-spin opacity-30" />
          ) : (
            <PhotoIcon className="h-12 w-12 opacity-20" />
          )}
          <QrcodeImageStatus scan={data?.scan ?? null} loading={loading} />
        </div>
      )}
      {data?.imageDataUrl && (
        <img
          src={data.imageDataUrl}
          alt=""
          className="block h-full w-full object-cover"
        />
      )}
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
  useSubmit: useGenQrImage,
  presets: ImagePresets,
};
