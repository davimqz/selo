import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { SELO_PROGRAM_ADDRESS } from "@selo/sdk";
import { DemoBar } from "@/components/Demo";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import { explorerAddress } from "@/lib/config";
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
  title: "Selo — One invoice. One lender. Ever.",
  description:
    "A public registry on Solana that blocks financing the same invoice twice.",
};

const REPO = "https://github.com/davimqz/selo";

const FOOTER_LINKS = [
  {
    title: "Demo",
    links: [
      { href: "/fornecedor", label: "Supplier" },
      { href: "/comprador", label: "Buyer" },
      { href: "/financiador", label: "Lender" },
      { href: "/verificar", label: "Verify an invoice" },
    ],
  },
  {
    title: "Build",
    links: [
      { href: REPO, label: "Source on GitHub" },
      { href: `${REPO}#integrating-checkinvoice`, label: "checkInvoice() SDK" },
      {
        href: explorerAddress(SELO_PROGRAM_ADDRESS),
        label: "Program on Explorer",
      },
    ],
  },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <div className="devnet-banner">
          <strong>Devnet</strong> — test tokens only. No real money.
        </div>
        <Providers>
          <Nav />
          <DemoBar />
          <main className="flex flex-1 flex-col">{children}</main>
        </Providers>
        <footer className="border-line bg-surface-alt border-t">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
            <div className="max-w-sm space-y-4">
              <Image
                src="/logo.png"
                alt="Selo"
                width={904}
                height={235}
                className="h-6 w-auto"
              />
              <p className="text-muted leading-relaxed">
                A registry, not a lender. Only the invoice hash and its amount,
                currency and due date go on-chain.
              </p>
              <p className="text-muted font-mono text-xs break-all">
                Program {SELO_PROGRAM_ADDRESS}
              </p>
            </div>
            {FOOTER_LINKS.map((group) => (
              <div key={group.title} className="space-y-3">
                <div className="caption">{group.title}</div>
                <ul className="space-y-2">
                  {group.links.map((l) =>
                    l.href.startsWith("/") ? (
                      <li key={l.label}>
                        <Link href={l.href} className="hover:text-brand">
                          {l.label}
                        </Link>
                      </li>
                    ) : (
                      <li key={l.label}>
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-brand"
                        >
                          {l.label} ↗
                        </a>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-line text-muted mx-auto flex max-w-7xl flex-wrap justify-between gap-2 border-t px-4 py-5 text-xs sm:px-6">
            <span>Solana devnet demo · MIT license</span>
            <span>One invoice. One lender. Ever.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
