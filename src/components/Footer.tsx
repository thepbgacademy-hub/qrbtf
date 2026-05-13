import { Container } from "@/components/Containers";
import { ModeToggle } from "@/components/ModeToggle";
import { NextIntlClientProvider, useMessages } from "next-intl";
import pick from "lodash/pick";
import React from "react";

export function Footer() {
  const messages = useMessages();

  return (
    <footer className="mt-12 border-t py-6">
      <Container>
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>PBG Art QR Studio</p>
          <NextIntlClientProvider messages={pick(messages, ["ModeToggle"])}>
            <ModeToggle />
          </NextIntlClientProvider>
        </div>
        <p className="safe-pb" />
      </Container>
    </footer>
  );
}
