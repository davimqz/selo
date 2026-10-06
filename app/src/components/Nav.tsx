"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/fornecedor", label: "Supplier" },
  { href: "/comprador", label: "Buyer" },
  { href: "/financiador", label: "Lender" },
  { href: "/verificar", label: "Verify" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="seal-mark" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Selo</span>
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded px-2.5 py-1 ${
                path === l.href
                  ? "bg-ink text-paper"
                  : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
