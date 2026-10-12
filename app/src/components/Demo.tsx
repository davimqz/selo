"use client";

/**
 * Demo mode (local only, see app/api/demo-wallets): sign with the devnet demo
 * wallets instead of a wallet extension, so the five moments can be recorded
 * without switching accounts. Transactions are real; off by default.
 */
import { type KeyPairSigner, createKeyPairSignerFromBytes } from "@solana/kit";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { InvoiceForm } from "@/lib/invoice";

export type DemoRole = "supplier" | "buyer" | "lenderA" | "lenderB";

export const ROLE_LABEL: Record<DemoRole, string> = {
  supplier: "Supplier",
  buyer: "Buyer",
  lenderA: "Lender A",
  lenderB: "Lender B",
};

/** Which demo roles act on each screen; the first is the default. */
const ROUTE_ROLES: Record<string, DemoRole[]> = {
  "/fornecedor": ["supplier"],
  "/comprador": ["buyer"],
  "/financiador": ["lenderA", "lenderB"],
};

interface DemoWallet {
  role: DemoRole;
  signer: KeyPairSigner;
}

interface Demo {
  wallets: DemoWallet[];
  /** The demo wallet signing now; undefined means the user's own wallet. */
  active?: DemoWallet;
  setRole: (role: DemoRole | null) => void;
  wallet: (role: DemoRole) => DemoWallet | undefined;
  /** The invoice last sealed in this demo, reused by the other screens. */
  invoice?: InvoiceForm;
  remember: (invoice: InvoiceForm) => void;
}

const DemoContext = createContext<Demo>({
  wallets: [],
  setRole: () => {},
  wallet: () => undefined,
  remember: () => {},
});

export const useDemo = () => useContext(DemoContext);

const ROLE_KEY = "selo:demo-role";
const INVOICE_KEY = "selo:demo-invoice";

function load<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<DemoWallet[]>([]);
  const [role, setRoleState] = useState<DemoRole | null>(null);
  const [invoice, setInvoice] = useState<InvoiceForm>();

  useEffect(() => {
    let live = true;
    fetch("/api/demo-wallets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        async (
          body: { wallets: { role: DemoRole; secretKey: number[] }[] } | null,
        ) => {
          if (!body || !live) return;
          const loaded = await Promise.all(
            body.wallets.map(async (w) => ({
              role: w.role,
              signer: await createKeyPairSignerFromBytes(
                Uint8Array.from(w.secretKey),
              ),
            })),
          );
          if (!live) return;
          setWallets(loaded);
          setRoleState(load<DemoRole>(ROLE_KEY) ?? null);
          setInvoice(load<InvoiceForm>(INVOICE_KEY));
        },
      )
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const value: Demo = {
    wallets,
    active: wallets.find((w) => w.role === role),
    setRole: (r) => {
      setRoleState(r);
      save(ROLE_KEY, r);
    },
    wallet: (r) => wallets.find((w) => w.role === r),
    invoice,
    remember: (f) => {
      setInvoice(f);
      save(INVOICE_KEY, f);
    },
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** The demo bar under the nav: only rendered when demo mode is available. */
export function DemoBar() {
  const { wallets, active, setRole } = useDemo();
  const path = usePathname();

  // Follow the screen: the supplier page signs as the supplier, and so on.
  const allowed = ROUTE_ROLES[path];
  const mismatch = active && allowed && !allowed.includes(active.role);
  useEffect(() => {
    if (mismatch) setRole(allowed[0]);
  }, [mismatch, allowed, setRole]);

  if (wallets.length === 0) return null;
  const choices = allowed ?? wallets.map((w) => w.role);

  return (
    <div className="bg-brand-50 border-line border-b">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:px-6">
        <span className="text-brand font-medium">Demo mode</span>
        <span className="text-muted hidden md:inline">
          Real devnet transactions, signed with the local demo wallets.
        </span>
        <div className="segmented ml-auto bg-white/70">
          {choices.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={active?.role === r}
              onClick={() => setRole(r)}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={!active}
            onClick={() => setRole(null)}
          >
            My wallet
          </button>
        </div>
      </div>
    </div>
  );
}

/** A fresh invoice number per take: a sealed invoice stays sealed forever. */
export function freshDemoInvoice(): InvoiceForm {
  const due = new Date(Date.now() + 90 * 86_400_000);
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return {
    supplierTaxId: "DE 811 907 980",
    buyerTaxId: "US 94-1081436",
    number: `INV-2026-${n}`,
    amount: "12,500.00",
    currency: "USD",
    dueDate: due.toISOString().slice(0, 10),
  };
}

/** Same invoice, typed the way a second registration might type it. */
export function retyped(f: InvoiceForm): InvoiceForm {
  return {
    ...f,
    supplierTaxId: f.supplierTaxId.toLowerCase().replace(/\s+/g, "  "),
    buyerTaxId: f.buyerTaxId.toLowerCase().replace("-", " - "),
    number: `  ${f.number.toLowerCase().replace(/-/g, " - ")} `,
    amount: f.amount.replace(/,/g, ""),
    currency: f.currency.toLowerCase(),
  };
}
