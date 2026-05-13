import createMiddleware from "next-intl/middleware";
import { locales, localePrefix } from "./navigation";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware({
  defaultLocale: "en",
  localePrefix,
  locales,
});

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const localePattern = locales.join("|");
  const localeRoot = new RegExp(`^/(${localePattern})/?$`);
  const oldStyleRoute = new RegExp(
    `^/(${localePattern})/style/(?!image/?$)[^/]+/?$`,
  );

  const localeRootMatch = pathname.match(localeRoot);
  const oldStyleMatch = pathname.match(oldStyleRoute);
  if (localeRootMatch || oldStyleMatch) {
    const locale = (localeRootMatch || oldStyleMatch)?.[1] || "en";
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/style/image`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    "/",

    // Set a cookie to remember the previous locale for
    // all requests that have a locale prefix
    "/(zh|en|jp)/:path*",

    // Enable redirects that add missing locales
    // (e.g. `/pathnames` -> `/en/pathnames`)
    "/((?!_next|_vercel|api|mp|.*\\..*).*)",
  ],
};
