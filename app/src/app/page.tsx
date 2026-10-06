import Link from "next/link";

const STEPS = [
  {
    href: "/fornecedor",
    who: "Supplier",
    what: "Seals the invoice. Only its hash goes on-chain, and the same invoice can never be sealed twice.",
  },
  {
    href: "/comprador",
    who: "Buyer",
    what: "Attests the invoice is real and due.",
  },
  {
    href: "/financiador",
    who: "Lender",
    what: "Checks Selo before financing and locks the invoice. A second lender is rejected and sees who financed it.",
  },
  {
    href: "/verificar",
    who: "Anyone",
    what: "Verifies an invoice's public status. No wallet needed.",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="max-w-3xl space-y-4 pt-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          One invoice. Financed once.
        </h1>
        <p className="text-lg text-muted">
          Receivables are financed by lenders who cannot see each other, so the
          same invoice can be pledged twice — or a fake one financed many times.
          Selo is a public, neutral registry on Solana: before financing, a
          lender checks the invoice; if someone else already financed it, the
          second lock is rejected.
        </p>
        <p className="text-sm text-muted">
          Selo is not a lender: no pool, no loans. Credit protocols and
          factoring companies are its users.
        </p>
      </section>
      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className="card block h-full hover:bg-wash">
              <div className="font-mono text-xs text-muted">0{i + 1}</div>
              <div className="mt-1 font-semibold">{s.who}</div>
              <p className="mt-1 text-sm text-muted">{s.what}</p>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
