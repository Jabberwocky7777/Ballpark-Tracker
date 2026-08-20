import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { ingestPhoto, MAX_BYTES, type IngestReport } from "@/lib/ingest/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The upload endpoint. Three locks, in order:
 *
 *   1. middleware 404s this path when the request arrives on the public
 *      hostname, so from the internet it does not exist
 *   2. the reverse proxy does not route it at all -- uploads come over
 *      Tailscale or the LAN
 *   3. a real login, checked here, because Tailscale is the wall and this is
 *      the lock
 *
 * The response is a per-file report rather than a bare 200. Section 4.1 of the
 * plan is emphatic that EXIF loss has to be visible at the moment of upload:
 * the share sheet strips location depending on a toggle neither phone agrees
 * about, and finding out months later means re-deriving where 400 photos were
 * taken from memory.
 *
 * Nothing slow happens here. Ingest hashes, stores and writes a row; decoding
 * and derivatives are queued for the worker, because a 50-photo HEIC batch is
 * minutes of CPU and would time out.
 */

/** Enough for a full evening off one phone; short of a whole-library dump. */
const MAX_FILES = 60;

/**
 * The wire shape, declared once and imported by the page that renders it.
 * Typing the response here means a field renamed in the route stops the build
 * rather than quietly rendering as `undefined` on the upload screen.
 */
export interface UploadSummary {
  stored: number;
  duplicates: number;
  rejected: number;
  /** The ones that will need a park picking by hand. */
  noGps: number;
  needsAPark: number;
}

export interface UploadResponse {
  reports: IngestReport[];
  summary: UploadSummary;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    // Same 404 the middleware would have given. A 401 here would confirm the
    // endpoint exists to anyone who got this far.
    return new NextResponse(null, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "That upload did not arrive as a form. Try again from the upload page." },
      { status: 400 },
    );
  }

  const uploadedBy = uploaderFrom(form.get("uploaded_by"));
  if (!uploadedBy) {
    return NextResponse.json({ error: "Say which of you is uploading." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files came through." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `${files.length} files at once is too many. ${MAX_FILES} is the limit.` },
      { status: 413 },
    );
  }

  const reports: IngestReport[] = [];

  for (const file of files) {
    // Checked before reading the bytes into memory, not after.
    if (file.size > MAX_BYTES) {
      reports.push(rejected(file.name, `larger than the ${MAX_BYTES / 1024 / 1024}MB limit`, file.size));
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      reports.push(await ingestPhoto({ buffer, filename: file.name, uploadedBy }));
    } catch (err) {
      // One bad file does not take the other fifty-nine with it.
      console.error(`[upload] ${file.name} failed:`, err);
      reports.push(rejected(file.name, "something went wrong storing this one", file.size));
    }
  }

  const stored = reports.filter((r) => r.outcome === "stored");

  const body: UploadResponse = {
    reports,
    summary: {
      stored: stored.length,
      duplicates: reports.filter((r) => r.outcome === "duplicate").length,
      rejected: reports.filter((r) => r.outcome === "rejected").length,
      // The number that matters, and it should be visible immediately.
      noGps: stored.filter((r) => r.gps === "none").length,
      needsAPark: stored.filter((r) => r.confidence !== "confident").length,
    },
  };

  return NextResponse.json(body);
}

/** user_a or user_b only. Never a real name, and never free text from a form. */
function uploaderFrom(value: FormDataEntryValue | null): string | null {
  return value === "user_a" || value === "user_b" ? value : null;
}

function rejected(filename: string, reason: string, bytes: number): IngestReport {
  return {
    filename,
    outcome: "rejected",
    photoId: null,
    reason,
    gps: "none",
    date: "none",
    venueId: null,
    confidence: "unmatched",
    assignedVisit: false,
    homeGuardFlag: false,
    bytes,
  };
}
