import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

/**
 * Everything under /admin requires a session. The middleware has already made
 * these routes 404 for the public hostname; this is the second lock.
 *
 * force-dynamic because an authenticated page must never be cached or
 * prerendered -- a cached admin page is an admin page served to everyone.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <div>
      <nav className="label flex gap-4 border-b border-ink-line pb-3 text-chalk-dim">
        <Link href="/admin" className="hover:text-chalk">Queue</Link>
        <Link href="/admin/visits" className="hover:text-chalk">Visits</Link>
        <form action="/api/admin/logout" method="post" className="ml-auto">
          <button type="submit" className="label text-chalk-dim hover:text-chalk">Sign out</button>
        </form>
      </nav>
      {children}
    </div>
  );
}
