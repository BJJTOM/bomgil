import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// `www.moruwalk.com` is reachable but should not serve a duplicate of
// the apex — point it at the canonical origin with a 308 so search
// engines consolidate link equity and users always land on the same URL.
const APEX_HOST = "moruwalk.com";
const WWW_HOST = `www.${APEX_HOST}`;

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host === WWW_HOST) {
    const url = request.nextUrl.clone();
    url.host = APEX_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
