import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

/**
 * Uploading, from a phone on the tailnet.
 *
 * The instructions above the form are not decoration. The single largest risk
 * to this whole project is the share sheet quietly dropping location, and the
 * fix is knowing which path to take before the photos are sent, not after.
 */
export default function UploadPage() {
  const names = {
    userA: process.env.USER_A_NAME ?? "A",
    userB: process.env.USER_B_NAME ?? "B",
  };

  return (
    <main className="pt-5">
      <h1 className="display text-[26px] leading-tight text-ink">Upload</h1>
      <p className="mt-2 text-[14px] text-ink-body">
        Photos land private, matched to a park by their location where they have one.
      </p>

      <section className="mt-6 border border-paper-line bg-card p-4">
        <h2 className="label text-muted">Send them the right way</h2>
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-body">
          <li>
            From Photos, tap share, then <strong className="text-ink">Options</strong> at the top
            and switch <strong className="text-ink">Location</strong> on. It is off more often
            than not, and once it is off the coordinates are gone before the file ever gets here.
          </li>
          <li>
            Anything sent through Messages, WhatsApp or a cloud link has already been stripped.
            Those still upload — they just need a park picking by hand.
          </li>
          <li>Uploading from the Files app keeps everything intact.</li>
        </ul>
      </section>

      <UploadForm names={names} />
    </main>
  );
}
