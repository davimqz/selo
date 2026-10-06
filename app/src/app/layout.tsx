import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
          Devnet — test tokens only. No real money.
        </div>
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            {children}
          </main>
        </Providers>
        <footer className="border-t border-line py-4 text-center text-xs text-muted">
          Selo is a registry, not a lender. Only the invoice hash and its
          amount, currency and due date go on-chain.
        </footer>
      </body>
    </html>
  );
}
