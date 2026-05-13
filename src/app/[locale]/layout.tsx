import type { Viewport } from "next";
import "../globals.css";
import { Providers } from "@/app/providers";
import { Footer } from "@/components/Footer";

import { layoutViewport } from "@/lib/layout_data";
import { Header } from "@/components/Header";
import { NextIntlClientProvider } from "next-intl";
import pick from "lodash/pick";
import React from "react";
import { getMessages } from "next-intl/server";
import { cn } from "@/lib/utils";
import { SessionProvider } from "@/lib/latentcat-auth/client";
import { getServerSession } from "@/lib/latentcat-auth/server";

export { generateMetadata } from "@/lib/layout_data";

export const viewport: Viewport = layoutViewport;

export default async function RootLayout({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const session = await getServerSession();
  const messages = await getMessages();

  return (
    <html lang={locale} className="antialiased" suppressHydrationWarning>
      <body className={cn("font-sans")}>
        <SessionProvider session={{ data: session }}>
          <Providers>
            <NextIntlClientProvider
              messages={pick(messages, ["header", "user_button"])}
            >
              <Header />
            </NextIntlClientProvider>
            <div className="min-h-screen flex flex-col">{children}</div>
            <Footer />
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}
