import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simplified middleware — next-intl locale routing disabled for now
// to allow direct page access without /[locale] prefix.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
