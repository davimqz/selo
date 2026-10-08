import Link from "next/link";

const STEPS = [
  {
    href: "/fornecedor",
    who: "Supplier",
    title: "Seals the invoice",
    what: "The invoice becomes a canonical hash in the browser. Sealing the same invoice again fails, however it is typed.",
  },
  {
    href: "/comprador",
    who: "Buyer",
    title: "Attests it is real",
    what: "The buyer confirms the invoice is real and due. Lenders can only finance attested invoices.",
  },
  {
    href: "/financiador",
    who: "Lender A",
    title: "Checks and locks",
    what: "The registry says the invoice is free. Lender A finances it and locks it in Selo.",
  },
  {
    href: "/financiador",
    who: "Lender B",
    title: "Is rejected",
    what: "Any other lender trying to lock the same invoice is rejected and sees who financed it first.",
  },
];

const SNIPPET = `import { checkInvoice } from "@selo/sdk";

const check = await checkInvoice(rpc, {
  supplierTaxId: "DE 811 907 980",
  buyerTaxId: "US 94-1081436",
  number: "INV-2026-0042",
  amount: 1250000n, // minor units: USD 12,500.00
  currency: "USD",
  dueDate: "2026-12-15",
});

if (check.status === "locked") {
  // Already financed by Lender A on 09 Oct 2026
  return decline(check.lender, check.lockedAt);
}`;

export default function Landing() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <ForLenders />
      <OnChain />
      <Closing />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="backdrop-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
        <div>
          <h1 className="heading-1 max-w-xl">One invoice. Financed once.</h1>
          <p className="text-muted mt-6 max-w-lg text-lg leading-relaxed">
            Selo is a public registry of invoices on Solana. Lenders check an
            invoice before financing it. If another lender already did, the
            second one is rejected on-chain.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/fornecedor" className="btn btn-primary btn-lg">
              Run the demo
            </Link>
            <Link href="/verificar" className="btn btn-ghost btn-lg">
              Verify an invoice
            </Link>
          </div>
          <p className="text-muted mt-6 text-sm">
            Running on Solana devnet with test tokens.
          </p>
        </div>
        <LedgerDemo />
      </div>
    </section>
  );
}

/** The product in one picture: lender A locks, lender B is rejected. */
function LedgerDemo() {
  return (
    <div
      className="bg-paper rounded-2xl p-2 shadow-[var(--shadow-raised)]"
      aria-label="Example: a second lender is rejected"
    >
      <div className="bg-wash flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3">
        <div>
          <div className="text-muted text-xs">Invoice hash</div>
          <div className="font-mono text-sm">9f2c71e0…b8d4a41e</div>
        </div>
        <div className="text-right">
          <div className="text-muted text-xs">USD, due 15 Dec 2026</div>
          <div className="text-sm font-semibold">12,500.00</div>
        </div>
      </div>
      <ol className="space-y-2 p-2 pt-3">
        <li className="ledger-row flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">Sealed and attested</div>
            <div className="text-muted text-xs">
              Supplier sealed it, buyer confirmed it is due
            </div>
          </div>
          <span className="badge badge-free">Sealed</span>
        </li>
        <li className="ledger-row flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">Lender A locks it</div>
            <div className="text-muted text-xs">
              09 Oct 2026, 1 USDC-dev fee
            </div>
          </div>
          <span className="badge bg-brand-50 text-brand">Financed</span>
        </li>
        <li className="ledger-row space-y-2 rounded-xl px-3 py-2.5">
          <div className="text-sm font-medium">Lender B tries to lock it</div>
          <div className="stamp py-3 text-sm" role="presentation">
            <div className="font-semibold">Rejected by the Selo program</div>
            <div className="mt-0.5">
              Already financed by Lender A on 09 Oct 2026. It cannot be financed
              twice.
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}

function Problem() {
  return (
    <section className="bg-wash border-line border-y">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <h2 className="heading-3 max-w-md">
          Lenders who finance invoices cannot see each other
        </h2>
        <div className="text-muted max-w-xl space-y-4 text-lg leading-relaxed">
          <p>
            A supplier can pledge the same invoice to two lenders, or invent an
            invoice and finance it several times. Each lender only sees its own
            book, so nobody notices until the money is gone.
          </p>
          <p>
            In the First Brands collapse, prosecutors allege fake invoices and
            collateral pledged two or three times over, with billions lost by
            creditors.
          </p>
          <p className="text-ink font-medium">
            Selo gives every lender the same view: one public record per
            invoice, checked before the money moves.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="heading-3 max-w-xl">How it works</h2>
      <p className="text-muted mt-4 max-w-xl text-lg">
        Four moments, each a Solana transaction that confirms in under a second.
        Try them in order with the demo wallets.
      </p>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.who}>
            <Link
              href={s.href}
              className={`card group block h-full transition-shadow hover:shadow-[var(--shadow-raised)] ${
                i === 3 ? "ring-1 ring-red-500/30" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  i === 3 ? "bg-red-50 text-stamp" : "bg-brand-50 text-brand"
                }`}
              >
                {i + 1}
              </span>
              <div className="text-muted mt-5 text-sm">{s.who}</div>
              <div className="mt-0.5 font-semibold">{s.title}</div>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                {s.what}
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ForLenders() {
  return (
    <section className="bg-[var(--gray-950)] text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <h2 className="heading-3">One call in your credit flow</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-[#a8a9b4]">
            Factoring companies and credit protocols add{" "}
            <code className="font-mono text-white">checkInvoice()</code> before
            they fund. It hashes the invoice locally and reads its record in
            Selo: free, sealed, financed, closed or cancelled.
          </p>
          <p className="mt-4 max-w-md leading-relaxed text-[#a8a9b4]">
            Lenders pay a small fee for each invoice they lock. It costs less
            than a single loss to a double-pledged invoice, and the registry
            gets more useful with every lender that checks it.
          </p>
        </div>
        <Code source={SNIPPET} />
      </div>
    </section>
  );
}

function OnChain() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="heading-3 max-w-xl">What goes on-chain</h2>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="font-semibold">Public</div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            The invoice hash, face amount, currency, due date, whether the buyer
            attested, and which lender locked it and when. That is what a lender
            needs to decide.
          </p>
        </div>
        <div className="card">
          <div className="font-semibold">Never stored</div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            Company names, tax IDs, descriptions and documents. They stay with
            the parties; only their canonical hash is published.
          </p>
        </div>
        <div className="card">
          <div className="font-semibold">Limits, stated plainly</div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            Tax IDs have little entropy, so someone who already knows both
            parties can test a guess. Selo only catches duplicates among lenders
            that check it, and a seal does not replace the assignment contract.
          </p>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <div className="bg-brand-50 flex flex-col items-start justify-between gap-6 rounded-2xl p-8 sm:p-10 md:flex-row md:items-center">
        <div className="max-w-xl">
          <h2 className="heading-4">Selo is a registry, not a lender</h2>
          <p className="text-muted mt-3 leading-relaxed">
            No pool, no loans, no token. Factoring companies and credit
            protocols are its users, not its competitors.
          </p>
        </div>
        <Link href="/fornecedor" className="btn btn-primary btn-lg">
          Seal your first invoice
        </Link>
      </div>
    </section>
  );
}

/** Tiny TypeScript highlighter for the one snippet on this page. */
function Code({ source }: { source: string }) {
  const token =
    /(\/\/.*$)|("[^"]*")|\b(import|from|const|await|if|return)\b|\b(\d+n?)\b/gm;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of source.matchAll(token)) {
    parts.push(source.slice(last, m.index));
    const tone = m[1]
      ? "text-[#747686]"
      : m[2]
        ? "text-[#7ee0a1]"
        : m[3]
          ? "text-[#a48bff]"
          : "text-[#5fd3f5]";
    parts.push(
      <span key={m.index} className={tone}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  parts.push(source.slice(last));

  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--gray-900)] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_24px_48px_-12px_rgb(0_0_0/0.5)]">
      <div className="border-b border-white/10 px-5 py-3 font-mono text-xs text-[#a8a9b4]">
        credit-check.ts
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-[#e4e4e9]">
        <code>{parts}</code>
      </pre>
    </div>
  );
}
