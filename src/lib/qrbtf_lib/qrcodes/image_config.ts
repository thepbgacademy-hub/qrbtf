import { useTranslations } from "next-intl";
import { CommonControlProps } from "./param";
import type { QrbtfRendererImageProps } from "./image";

export type ImagePresetKeys = "image";

export const ImagePresets: Record<ImagePresetKeys, QrbtfRendererImageProps> = {
  image: {
    sourceImage: "",
    prompt: "",
    negativePrompt: "",
    seedHint: -1,
    hiddenArtBlend: 0.85,
    scanStrictness: 0.35,
    size: "1024x1024",
    paddingRatio: 0.2,
    correctLevel: "15",
    anchorStyle: "minimal",
  },
};

export function useImageParams() {
  const t = useTranslations("qrcodes.image");
  const params: CommonControlProps<QrbtfRendererImageProps>[] = [
    {
      type: "image",
      name: "sourceImage",
      label: t("sourceImage.label"),
      desc: t("sourceImage.desc"),
      config: { buttonLabel: t("sourceImage.button") },
    },
    {
      type: "prompt",
      name: "prompt",
      label: t("prompt.label"),
      desc: t("prompt.desc"),
      config: { placeholder: t("prompt.placeholder") },
    },
    {
      type: "text",
      name: "negativePrompt",
      label: t("negativePrompt.label"),
      desc: t("negativePrompt.desc"),
      config: { placeholder: t("negativePrompt.placeholder") },
    },
    {
      type: "number",
      name: "seedHint",
      label: t("seedHint.label"),
      desc: t("seedHint.desc"),
      config: { min: -1, max: 9999 },
    },
    {
      type: "number",
      name: "hiddenArtBlend",
      label: t("hiddenArtBlend.label"),
      desc: t("hiddenArtBlend.desc"),
      config: { min: 0, max: 1, step: 0.01 },
    },
    {
      type: "number",
      name: "scanStrictness",
      label: t("scanStrictness.label"),
      desc: t("scanStrictness.desc"),
      config: { min: 0, max: 1, step: 0.01 },
    },
    {
      type: "select",
      name: "size",
      label: t("size.label"),
      desc: t("size.desc"),
      config: {
        values: [
          { value: "1024x1024", label: "1024px" },
        ],
      },
    },
    {
      type: "number",
      name: "paddingRatio",
      label: t("paddingRatio.label"),
      desc: t("paddingRatio.desc"),
      config: { min: 0, max: 0.4, step: 0.01 },
    },
    {
      type: "select",
      name: "correctLevel",
      label: t("correctLevel.label"),
      desc: t("correctLevel.desc"),
      config: {
        values: [
          { value: "7", label: "7%" },
          { value: "15", label: "15%" },
          { value: "25", label: "25%" },
          { value: "30", label: "30%" },
        ],
      },
    },
    {
      type: "select",
      name: "anchorStyle",
      label: t("anchorStyle.label"),
      desc: t("anchorStyle.desc"),
      config: {
        values: [
          { value: "minimal", label: t("anchorStyle.minimal") },
          { value: "blended", label: t("anchorStyle.blended") },
          { value: "square", label: t("anchorStyle.square") },
          { value: "circle", label: t("anchorStyle.circle") },
        ],
      },
    },
  ];
  return { params };
}
