import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Selo — one invoice, financed once",
  description:
    "A public registry on Solana that blocks financing the same invoice twice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <div className="devnet-banner">
          <strong>Devnet</strong> — test tokens only. No real money.
        </div>
        <Providers>
          <Nav />
          <main className="flex flex-1 flex-col">{children}</main>
        </Providers>
        <footer className="border-line border-t">
          <div className="text-muted mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs sm:px-6">
            <span>
              Selo is a registry, not a lender. Only the invoice hash and its
              amount, currency and due date go on-chain.
            </span>
            <a
              href="https://github.com/davimqz/selo"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              Source on GitHub
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
