import type { Metadata } from "next";
import { Oswald, Public_Sans, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Oswald replaced the earlier italic serif: bold condensed reads as ballpark
// scoreboard rather than generic app.
const display = Oswald({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-oswald",
});
const body = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });
const tabular = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  title: "Ballpark Tracker",
  description: "Every MLB ballpark, one game at a time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${tabular.variable}`}>
      <body>
        <div className="shell px-5">
          <header className="flex items-baseline justify-between border-b border-paper-line pt-7 pb-4">
            <Link href="/" className="display text-[24px] tracking-[0.04em] sm:text-[30px]">
              Ballpark Tracker
            </Link>
            <nav className="label flex gap-4 text-muted">
              <Link href="/repeated" className="hover:text-accent">
                The shot
              </Link>
            </nav>
          </header>
          {children}
          <footer className="label mt-12 flex items-baseline justify-between border-t border-paper-line py-6 text-muted">
            <span>Kept by two people since 2015</span>
            <Link href="/credits" className="hover:text-accent">
              Photo credits
            </Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
