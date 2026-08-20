import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Deploy check. Public on purpose -- it reveals nothing beyond "the process is
 * up and the database answers", and it is the fastest way to tell a broken
 * mount from a broken proxy.
 */
export function GET() {
  try {
    const venues = getDb().select({ id: schema.venues.id }).from(schema.venues).all().length;
    return NextResponse.json({ ok: true, venues });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
