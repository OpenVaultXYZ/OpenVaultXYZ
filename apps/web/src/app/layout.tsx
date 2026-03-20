import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SearchBar } from "@/components/search/SearchBar";

export const metadata: Metadata = {
  title: "OpenVault — Hyperliquid Vault Analytics",
  description:
    "Independent risk-adjusted analytics and ratings for Hyperliquid vaults. Sharpe ratios, drawdown analysis, strategy fingerprinting, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-slate-200 antialiased min-h-screen">
        <header className="border-b border-border sticky top-0 z-50 bg-bg/95 backdrop-blur-sm">
          <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-6">
            <a href="/" className="flex items-center gap-2 shrink-0">
              <span className="text-teal-400 font-semibold text-lg tracking-tight">
                OpenVault
              </span>
              <span className="text-muted text-xs font-mono hidden sm:block">
                HL Analytics
              </span>
            </a>
            <div className="flex-1 max-w-sm">
              <Suspense fallback={<div className="w-full h-8 bg-surface rounded-md border border-border" />}>
                <SearchBar />
              </Suspense>
            </div>
            <nav className="hidden md:flex items-center gap-4 text-sm text-neutral-400">
              <a href="/" className="hover:text-slate-200 transition-colors">
                Leaderboard
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-screen-xl mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-border mt-16 py-6 text-center text-xs text-muted">
          OpenVault — Independent analytics. Not affiliated with Hyperliquid.
        </footer>
      </body>
    </html>
  );
}
