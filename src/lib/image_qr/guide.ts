import { encode, QRPointType } from "@/lib/qrbtf_lib/encoder";
import { PNG } from "pngjs";
import type { ImageQrGenerationOptions } from "./types";

const ECC_BY_PERCENT: Record<
  ImageQrGenerationOptions["correctLevel"],
  "low" | "medium" | "quartile" | "high"
> = {
  "7": "low",
  "15": "medium",
  "25": "quartile",
  "30": "high",
};

function moduleOpacity(
  type: QRPointType,
  isDark: boolean,
  options: ImageQrGenerationOptions,
) {
  if (!isDark) return options.scanStrictness > 0.65 ? 0.12 : 0.06;
  if (type === QRPointType.POS_CENTER || type === QRPointType.POS_OTHER) {
    return options.anchorStyle === "minimal" || options.anchorStyle === "blended"
      ? 0.38
      : 0.58;
  }
  if (
    type === QRPointType.TIMING ||
    type === QRPointType.ALIGN_CENTER ||
    type === QRPointType.ALIGN_OTHER
  ) {
    return 0.3 + options.scanStrictness * 0.2;
  }
  return 0.18 + options.scanStrictness * 0.26;
}

function blendOverGray(target: number, opacity: number) {
  const gray = 128;
  return Math.round(gray * (1 - opacity) + target * opacity);
}

function paintRect(
  png: PNG,
  left: number,
  top: number,
  width: number,
  height: number,
  value: number,
  opacity: number,
) {
  const x0 = Math.max(0, Math.floor(left));
  const y0 = Math.max(0, Math.floor(top));
  const x1 = Math.min(png.width, Math.ceil(left + width));
  const y1 = Math.min(png.height, Math.ceil(top + height));
  const channel = blendOverGray(value, opacity);

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = channel;
      png.data[index + 1] = channel;
      png.data[index + 2] = channel;
      png.data[index + 3] = 255;
    }
  }
}

export function renderQrGuidePngDataUrl(
  payload: string,
  options: ImageQrGenerationOptions,
) {
  const [table, typeTable] = encode(payload, {
    ecc: ECC_BY_PERCENT[options.correctLevel],
  });
  const modules = table.length;
  const size = Number(options.size.split("x")[0]);
  const padding = Math.round(size * options.paddingRatio);
  const usable = Math.max(1, size - padding * 2);
  const cell = usable / modules;
  const png = new PNG({ width: size, height: size });

  png.data.fill(128);
  for (let index = 3; index < png.data.length; index += 4) {
    png.data[index] = 255;
  }

  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      const isDark = table[x][y];
      const opacity = moduleOpacity(typeTable[x][y], isDark, options);
      paintRect(
        png,
        padding + x * cell,
        padding + y * cell,
        cell + 0.4,
        cell + 0.4,
        isDark ? 17 : 255,
        opacity,
      );
    }
  }

  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}
