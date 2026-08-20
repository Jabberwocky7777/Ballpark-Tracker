import type { Metadata } from "next";
import { Instrument_Serif, Public_Sans, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
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
          <header className="flex items-baseline justify-between pt-7 pb-5">
            <Link href="/" className="display text-[26px] italic leading-none text-chalk sm:text-[32px]">
              Ballpark Tracker
            </Link>
            <nav className="label flex gap-4 text-chalk-dim">
              <Link href="/repeated" className="hover:text-chalk-muted">
                The shot
              </Link>
            </nav>
          </header>
          {children}
          <footer className="label mt-12 border-t border-ink-line py-6 text-chalk-dim">
            Kept by two people since 2015
          </footer>
        </div>
      </body>
    </html>
  );
}
