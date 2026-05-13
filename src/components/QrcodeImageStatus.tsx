"use client";

import { Badge } from "@/components/ui/badge";
import { ImageQrScanResult } from "@/lib/image_qr/types";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

export function QrcodeImageStatus(props: {
  scan: ImageQrScanResult | null;
  loading?: boolean;
}) {
  if (props.loading) {
    return (
      <Badge variant="outline" className="gap-1 rounded-md">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Generating
      </Badge>
    );
  }

  if (!props.scan) return null;

  const passed = props.scan.status === "passed";
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <Badge
        variant={passed ? "default" : "outline"}
        className="w-fit gap-1 rounded-md"
      >
        {passed ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <CircleAlert className="h-3.5 w-3.5" />
        )}
        {passed ? "Scan passed" : "Needs retry"}
      </Badge>
      <span>{props.scan.message}</span>
    </div>
  );
}
