"use client";

import Image from "next/image";
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
    <header className="border-line bg-surface-alt/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Selo"
            width={904}
            height={235}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto text-sm font-medium sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 transition-colors ${
                path === l.href
                  ? "bg-brand-50 text-brand"
                  : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto sm:ml-0">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
