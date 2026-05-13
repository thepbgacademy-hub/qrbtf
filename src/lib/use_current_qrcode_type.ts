"use client";

import { usePathname } from "@/navigation";

export function useCurrentQrcodeType() {
  const pathname = usePathname();
  return pathname.split("/")[2] || "g1";
}
