import QrcodeGeneratorWithProvider from "@/components/QrcodeGeneratorWithProvider";
import { qrbtfModuleImage } from "@/lib/qrbtf_lib/qrcodes/image";
import type { QrbtfRendererImageProps } from "@/lib/qrbtf_lib/qrcodes/image";
import { useImageParams } from "@/lib/qrbtf_lib/qrcodes/image_config";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("qrcodes.image");
  const { params } = useImageParams();

  return (
    <QrcodeGeneratorWithProvider<QrbtfRendererImageProps>
      title={t("title")}
      label={t("label")}
      subtitle={t("subtitle")}
      desc={t("desc")}
      qrcodeModule={qrbtfModuleImage}
      params={params}
      defaultPreset="image"
    />
  );
}
