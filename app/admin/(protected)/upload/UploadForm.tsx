"use client";

import { useRef, useState } from "react";

/**
 * The upload form, and the per-file report that comes back.
 *
 * The report is the whole point of this screen. Section 4.1 of the plan: the
 * share sheet strips location depending on a toggle the two phones do not
 * agree about, so whether GPS survived has to be visible at the moment of
 * upload. Finding out later means reconstructing where 400 photos were taken
 * from memory.
 *
 * A client component because the file list, the progress and the report are
 * all live state. The route it posts to does the real work.
 */

interface Report {
  filename: string;
  outcome: "stored" | "duplicate" | "rejected";
  photoId: string | null;
  reason: string | null;
  gps: "found" | "none";
  date: "found" | "none";
  venueId: string | null;
  confidence: "confident" | "suggested" | "unmatched";
  assignedVisit: boolean;
  homeGuardFlag: boolean;
}

interface Summary {
  stored: number;
  duplicates: number;
  rejected: number;
  noGps: number;
  needsAPark: number;
}

export function UploadForm({ names }: { names: { userA: string; userB: string } }) {
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setReports(null);
    setSummary(null);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? `The upload came back ${response.status}. Nothing was stored.`);
        return;
      }

      const body = await response.json();
      setReports(body.reports);
      setSummary(body.summary);
      formRef.current?.reset();
    } catch {
      // Almost always the tailnet dropping, which is worth saying plainly
      // rather than dressing up as a server error.
      setError("The upload did not reach the server. Check you are on the tailnet, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form ref={formRef} onSubmit={submit} className="mt-7">
        <fieldset disabled={busy} className="border-0 p-0">
          <legend className="label text-muted">Whose photos are these</legend>
          <div className="mt-2 flex gap-5">
            {[
              { value: "user_a", label: names.userA },
              { value: "user_b", label: names.userB },
            ].map((who, i) => (
              <label key={who.value} className="flex items-center gap-2 text-[15px] text-ink">
                <input
                  type="radio"
                  name="uploaded_by"
                  value={who.value}
                  defaultChecked={i === 0}
                  required
                  className="accent-accent"
                />
                {who.label}
              </label>
            ))}
          </div>

          <label htmlFor="files" className="label mt-6 block text-muted">
            Photos
          </label>
          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept="image/*,.heic,.heif"
            required
            className="mt-2 w-full border border-paper-line bg-card px-3 py-2.5 text-[14px] text-ink outline-none file:mr-3 file:border-0 file:bg-paper-inset file:px-3 file:py-1.5 file:text-[13px] file:text-ink focus:border-accent"
          />

          <button
            type="submit"
            className="label mt-6 w-full bg-accent px-4 py-3 text-card hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? "Working through them…" : "Upload"}
          </button>
        </fieldset>
      </form>

      {busy && (
        <p className="mt-4 text-[13px] text-muted">
          Large batches take a moment. Leave this page open until it reports back.
        </p>
      )}

      {error && <p className="mt-5 text-[14px] text-accent">{error}</p>}

      {summary && reports && <Results summary={summary} reports={reports} />}
    </>
  );
}

function Results({ summary, reports }: { summary: Summary; reports: Report[] }) {
  return (
    <section className="mt-9">
      <h2 className="label text-muted">What arrived</h2>

      <p className="tabular mt-2 text-[15px] text-ink">
        {summary.stored} stored
        {summary.duplicates > 0 && `, ${summary.duplicates} already here`}
        {summary.rejected > 0 && `, ${summary.rejected} refused`}
      </p>

      {summary.stored > 0 && (
        <p className="mt-2 text-[14px] text-ink-body">
          {summary.noGps === 0
            ? "Every one of them carried its location."
            : `${summary.noGps} arrived with no location. ` +
              "That usually means the share sheet had Location switched off."}
          {summary.needsAPark > 0 && ` ${summary.needsAPark} need a park picking by hand.`}
        </p>
      )}

      <ul className="mt-5 border-t border-paper-line">
        {reports.map((report, i) => (
          <li key={`${report.filename}-${i}`} className="border-b border-paper-line py-2.5">
            <p className="text-[14px] text-ink">{report.filename}</p>
            <p className="mt-0.5 text-[13px] text-muted">{describe(report)}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] text-muted">
        Every photo is private. Publishing is a separate, deliberate act.
      </p>
    </section>
  );
}

function describe(report: Report): string {
  if (report.outcome === "duplicate") return "Already here — nothing was stored again.";
  if (report.outcome === "rejected") return `Refused — ${report.reason ?? "unreadable"}.`;

  const parts: string[] = [];

  if (report.gps === "found" && report.confidence === "confident") {
    parts.push(report.assignedVisit ? "Filed under its visit" : "Matched to its park");
  } else if (report.venueId) {
    parts.push("A park is suggested — confirm it in the queue");
  } else {
    parts.push("Needs a park");
  }

  if (report.gps === "none") parts.push("no location");
  if (report.date === "none") parts.push("no date either");
  if (report.homeGuardFlag) parts.push("taken near home, held for review");

  return parts.join(" · ") + ".";
}
