import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  checkPassword,
  currentClientAddress,
  isAuthenticated,
  requestIsHttps,
  throttleCheck,
  throttleRecordFailure,
  throttleReset,
} from "@/lib/auth";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The login page is inside /admin, so the middleware already 404s it for the
 * public hostname. It is only ever reachable over the tailnet or LAN.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthenticated()) redirect("/admin");
  const { error } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";

    const key = await currentClientAddress();
    const gate = throttleCheck(key);
    if (!gate.allowed) {
      redirect(`/admin/login?error=throttled`);
    }

    const password = String(formData.get("password") ?? "");
    if (!(await checkPassword(password))) {
      throttleRecordFailure(key);
      // One message for every failure mode. Never distinguish "no password
      // configured" from "wrong password" -- that is free reconnaissance.
      redirect(`/admin/login?error=1`);
    }

    throttleReset(key);
    const secret = process.env.SESSION_SECRET;
    if (!secret) redirect(`/admin/login?error=config`);

    const jar = await cookies();
    jar.set(SESSION_COOKIE, createSessionToken({ secret }), sessionCookieOptions(await requestIsHttps()));
    redirect("/admin");
  }

  return (
    <main className="pt-10">
      <h1 className="display text-[26px] leading-tight text-chalk">Sign in</h1>
      <p className="mt-2 text-[14px] text-chalk-muted">
        This is the filing side. The public site needs no sign in.
      </p>

      <form action={signIn} className="mt-7">
        <label htmlFor="password" className="label text-chalk-dim">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="mt-2 w-full border border-ink-line bg-ink-panel px-3 py-2.5 text-[15px] text-chalk outline-none focus:border-accent"
        />

        {error && (
          <p className="mt-3 text-[13px] text-accent">
            {error === "throttled"
              ? "Too many attempts. Wait fifteen minutes and try again."
              : error === "config"
                ? "The server has no session secret set. Set SESSION_SECRET and restart."
                : "That password didn't work. Try again."}
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full bg-accent py-2.5 text-[14px] font-medium text-ink hover:bg-accent-hover"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
