import Link from "next/link";
import type { Metadata } from "next";
import { referencePhotos } from "@/lib/data/park-reference-photos";
import { venues } from "@/lib/data/venues";

export const metadata: Metadata = {
  title: "Photo credits — Ballpark Tracker",
  description: "Where the stand-in ballpark photos come from.",
};

/**
 * Attribution for the borrowed photos.
 *
 * CC BY and CC BY-SA both require the author, the licence, and a link back.
 * The hover card carries the first two in the small space it has; this page is
 * where the full credit lives. It is not optional politeness -- without it the
 * images are being used outside their licence.
 */
export default function CreditsPage() {
  const nameById = new Map(venues.map((v) => [v.id, v.name]));
  const entries = Object.entries(referencePhotos).sort((a, b) =>
    (nameById.get(a[0]) ?? a[0]).localeCompare(nameById.get(b[0]) ?? b[0]),
  );

  return (
    <main className="pt-6 pb-10">
      <Link href="/" className="label text-muted hover:text-accent">
        ← Map
      </Link>

      <h1 className="display mt-5 text-[26px] sm:text-[32px]">Photo credits</h1>
      <p className="mt-3 max-w-[62ch] text-[14px] text-ink-body">
        Until we&apos;ve been somewhere and taken our own photo, the map borrows one. These are all
        freely licensed, from Wikimedia Commons, and belong to the photographers below. Our own
        photos replace them as we go.
      </p>
      <p className="mt-2 max-w-[62ch] text-[13px] text-muted">
        A few parks have no photo at all — there wasn&apos;t a freely licensed one taken from behind
        home plate, and the wrong photo is worse than none.
      </p>

      {entries.length === 0 ? (
        <p className="mt-6 text-[14px] text-muted">No borrowed photos in use.</p>
      ) : (
        <ul className="mt-7 divide-y divide-paper-line border-y border-paper-line">
          {entries.map(([venueId, photo]) => (
            <li key={venueId} className="flex items-center gap-3 py-3">
              <img
                src={photo.file}
                alt=""
                loading="lazy"
                className="h-11 w-[70px] shrink-0 rounded-[2px] border border-paper-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="display text-[13px]">{nameById.get(venueId) ?? venueId}</p>
                <p className="text-[12px] text-ink-body">{photo.author}</p>
              </div>
              <div className="shrink-0 text-right">
                {photo.licenceUrl ? (
                  <a
                    href={photo.licenceUrl}
                    rel="noreferrer noopener license"
                    target="_blank"
                    className="tabular text-[11px] text-muted underline hover:text-accent"
                  >
                    {photo.licence}
                  </a>
                ) : (
                  <span className="tabular text-[11px] text-muted">{photo.licence}</span>
                )}
                <br />
                <a
                  href={photo.sourceUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="label text-muted underline hover:text-accent"
                >
                  Source
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
