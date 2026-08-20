import { NextResponse, type NextRequest } from "next/server";
import { shouldHide } from "@/lib/host-gate";

/**
 * First lock: the admin and upload surfaces do not exist as far as the public
 * hostname is concerned.
 *
 * 404, never 403 -- a 403 confirms the route is there and worth attacking. The
 * response is deliberately indistinguishable from any other missing path.
 *
 * This runs before the route does, so a protected page never executes, never
 * touches the database, and never sets a cookie for a public request.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const { pathname } = request.nextUrl;

  if (shouldHide(pathname, host, process.env.PUBLIC_HOSTNAME)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/upload/:path*", "/api/admin/:path*"],
};
