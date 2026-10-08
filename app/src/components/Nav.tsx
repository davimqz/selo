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
    <header className="border-line bg-paper/85 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="seal-mark" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Selo</span>
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1 text-sm font-medium">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                path === l.href
                  ? "bg-brand-50 text-brand"
                  : "text-muted hover:bg-wash hover:text-ink"
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
