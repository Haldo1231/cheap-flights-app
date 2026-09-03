import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Cheap Flights — Compare fares from 4 Central European airports",
  description: "Find the cheapest way to fly from Vienna, Bratislava, Budapest, and Košice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable} font-sans antialiased`}>
        <header className="bg-[#14213D] text-white">
          <nav className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
              cheap<span className="text-[#FCA311]">flights</span>
            </Link>
            <div className="flex gap-6 text-sm">
              <Link href="/search" className="hover:text-[#FCA311] transition-colors">Search</Link>
              <Link href="/anywhere" className="hover:text-[#FCA311] transition-colors">Anywhere</Link>
              <Link href="/deals" className="hover:text-[#FCA311] transition-colors">Deals</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
