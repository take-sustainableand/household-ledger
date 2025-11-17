import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Sustainable Household Ledger",
  description: "Secure shared household budgeting for Papa & Mama",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <header className="border-b">
            <div className="container flex h-14 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs tracking-[0.25em] text-muted-foreground">
                  SUSTAINABLE
                </span>
                <span className="text-sm font-semibold">Household Ledger</span>
              </div>
              <nav className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                <Link href="/">ダッシュボード</Link>
                <Link href="/upload">明細アップロード</Link>
                <Link href="/transactions">明細一覧</Link>
                <Link href="/analytics">集計</Link>
                <Link href="/login" className="ml-2 text-foreground">
                  ログイン
                </Link>
              </nav>
            </div>
          </header>
          <main className="container flex-1 py-8">{children}</main>
          <footer className="border-t py-4">
            <div className="container flex items-center justify-between text-xs text-muted-foreground">
              <span>© {new Date().getFullYear()} Household Ledger</span>
              <span>Privacy by design · Supabase · Vercel</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
