"use client";

import React, { ReactNode } from "react";

import { Link } from "@/navigation";
import { LinkProps } from "next/link";

interface TrackLinkProps extends LinkProps {
  children?: ReactNode;
  trackValue: string | string[];
  className?: string;
  target?: string;
}

export const TrackLink: React.FC<TrackLinkProps> = ({
  trackValue,
  locale,
  ...props
}) => {
  void trackValue;
  void locale;
  return <Link {...props}>{props.children}</Link>;
};

export function trackEvent(name: string, properties?: Record<string, any>) {
  void name;
  void properties;
}
