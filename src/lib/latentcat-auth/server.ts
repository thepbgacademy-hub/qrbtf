"use server";

import { cache } from "react";
import { QrbtfUser } from "./common";
import { NEXT_PUBLIC_QRBTF_API_ENDPOINT } from "@/lib/env/client";
import { cookies } from "next/headers";

export const getServerSession = cache(
  async (): Promise<QrbtfUser | undefined> => {
    if (process.env.QRBTF_SKIP_SERVER_SESSION === "true") {
      return undefined;
    }

    const cookie = cookies();
    const resp = await fetch(`${NEXT_PUBLIC_QRBTF_API_ENDPOINT}/auth/session`, {
      headers: {
        Cookie: `lc_token=${cookie.get("lc_token")?.value || ""}`,
      },
    });
    if (!resp.ok) {
      return undefined;
    }

    const session = await resp.json();
    return session;
  },
);
