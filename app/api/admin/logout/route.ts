import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * POST only. A GET logout is a one-pixel image away from being triggered by
 * any page you happen to visit.
 */
export async function POST(request: Request) {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
}
