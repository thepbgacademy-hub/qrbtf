import { type Metadata, Viewport } from "next";

import { getTranslations } from "next-intl/server";
import React from "react";

export async function generateMetadata({
  params: { locale },
}: Readonly<{
  params: { locale: string };
}>) {
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    metadataBase: new URL("http://localhost:3000"),
    title: {
      template: t("title.template"),
      default: t("title.default"),
    },
    description: t("description"),
    keywords: [
      t("keywords.0"),
      t("keywords.1"),
      t("keywords.2"),
      t("keywords.3"),
      t("keywords.4"),
      t("keywords.5"),
      t("keywords.6"),
      t("keywords.7"),
      t("keywords.8"),
      t("keywords.9"),
    ],
    openGraph: {
      images: [],
    },
  };
}

export const layoutMetadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    template: "%s - PBG Art QR Studio",
    default: "PBG Art QR Studio",
  },
  description: "A local studio for generating hidden-image QR artwork.",
  keywords: [
    "QR Code",
    "qrcode",
    "AI QR Code",
    "AI qrcode",
    "Parametric QR Code",
    "PBG Art QR Studio",
    "Mid Real",
    "midreal",
  ],
  openGraph: {
    // title: 'Troy Ni',
    images: [],
  },
};

export const layoutViewport: Viewport = {
  themeColor: "black",
  width: "device-width",
  height: "device-height",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
};

