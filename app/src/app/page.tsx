import Link from "next/link";
import { type Invoice, canonicalize, invoiceHash, toHex } from "@selo/sdk";
import { Icon, type IconName } from "@/components/Icon";

const REPO = "https://github.com/davimqz/selo";

const STATS = [
  { value: "€4.04T", label: "Global factoring volume in 2025 (FCI)" },
  { value: "< 1 s", label: "To confirm a lock on Solana" },
  { value: "1", label: "Record per invoice, however it is typed" },
  { value: "0", label: "Names or documents stored on-chain" },
];

const STEPS = [
  {
    href: "/fornecedor",
    who: "Supplier",
    title: "Seals the invoice",
    what: "The invoice becomes a canonical hash in the browser. Only the hash, amount, currency and due date go on-chain.",
  },
  {
    href: "/comprador",
    who: "Verified buyer",
    title: "Attests it is real",
    what: "The company that owes the invoice confirms it is real and due. Lenders can only finance attested invoices.",
  },
  {
    href: "/financiador",
    who: "Lender A",
    title: "Checks and locks",
    what: "The registry says the invoice is free. Lender A finances it and locks it, paying a small fee.",
  },
  {
    href: "/financiador",
    who: "Lender B",
    title: "Is rejected",
    what: "Any other lender trying to lock the same invoice is rejected on-chain and sees who financed it first.",
  },
];

const GUARANTEES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "hash",
    title: "One address per invoice",
    text: "Tax IDs, number, amount, currency and due date are normalized and hashed. The hash derives the account, so a second copy cannot exist.",
  },
  {
    icon: "shield",
    title: "Verified buyers",
    text: "Only a company whose identity was verified can attest, and only for invoices issued against its own tax ID. A fraudster cannot confirm a fake invoice.",
  },
  {
    icon: "lock",
    title: "First lock wins",
    text: "Locking is atomic. Once one lender locks an invoice, every other lock fails in the program itself, not in a database someone could edit.",
  },
  {
    icon: "database",
    title: "Seals are never closed",
    text: "Paid or cancelled invoices keep their record forever. Closing one would free the address and let the same invoice be financed again.",
  },
  {
    icon: "globe",
    title: "Open to every lender",
    text: "Anyone can read the registry, no account needed. Each lender that checks it makes it more useful for all the others.",
  },
  {
    icon: "eyeOff",
    title: "Private by design",
    text: "Company names, tax IDs and documents never leave the parties. Lenders compare hashes, not invoices.",
  },
];

const FAQ = [
  {
    q: "Is Selo a lender?",
    a: "No. Selo has no pool, no loans and no token. It is a registry that lenders use before they finance. Factoring firms and on-chain credit protocols are its customers, not its competitors.",
  },
  {
    q: "Who pays, and how much?",
    a: "The lender pays a small fee each time it locks an invoice. In the devnet demo it is a fixed 1 USDC-dev; the pricing we assume for production is 5 basis points of face value, which is less than a single loss to a double-pledged invoice.",
  },
  {
    q: "What if a lender never checks Selo?",
    a: "Selo only catches duplicates among lenders that check it. That is why its value grows with every lender that joins, and why the check is one line of code with an open-source SDK.",
  },
  {
    q: "Can someone see my invoices?",
    a: "On-chain there is only a hash, the amount, the currency and the due date. Tax IDs have little entropy, so someone who already knows both parties could test a guess, but names and documents are never published.",
  },
  {
    q: "Does a seal replace the assignment contract?",
    a: "No. The seal proves who locked the invoice first; the legal assignment between supplier and lender still happens off-chain.",
  },
  {
    q: "Why Solana?",
    a: "A check is free and a lock costs a fraction of a cent and confirms in under a second. That makes it practical to check every invoice in real time, including small ones.",
  },
];

/** The same invoice, typed by two different people. */
const TYPED: { who: string; invoice: Invoice }[] = [
  {
    who: "Typed by the supplier",
    invoice: {
      supplierTaxId: "DE 811 907 980",
      buyerTaxId: "US 94-1081436",
      number: "INV-2026-0042",
      amount: 1250000n,
      currency: "USD",
      dueDate: "2026-12-15",
    },
  },
  {
    who: "Typed again, differently",
    invoice: {
      supplierTaxId: "de811907980",
      buyerTaxId: "us 94 1081436",
      number: "  inv - 2026 - 0042 ",
      amount: 1250000n,
      currency: "usd",
      dueDate: "2026-12-15",
    },
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
      <Stats />
      <Problem />
      <HowItWorks />
      <Retyped />
      <Guarantees />
      <ForLenders />
      <OnChain />
      <Faq />
      <Closing />
    </>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  band = false,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
  band?: boolean;
}) {
  return (
    <section
      id={id}
      className={band ? "border-line bg-surface-alt border-y" : undefined}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="caption text-brand">{eyebrow}</p>
          <h2 className="heading-2 mt-3">{title}</h2>
          {intro && (
            <p className="text-muted mt-4 text-base leading-relaxed">{intro}</p>
          )}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="backdrop-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-24">
        <div>
          <span className="badge badge-muted bg-paper text-ink-soft before:bg-brand">
            Live on Solana devnet
          </span>
          <h1 className="heading-1 mt-5 max-w-xl">
            One invoice. One lender. <span className="text-brand">Ever.</span>
          </h1>
          <p className="text-muted mt-5 max-w-lg text-lg leading-relaxed">
            Selo is a public registry of invoices on Solana. Lenders check an
            invoice before they finance it. If another lender already did, the
            second lock is rejected on-chain.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/fornecedor" className="btn btn-brand btn-lg">
              Run the demo <Icon name="arrow" />
            </Link>
            <Link href="/verificar" className="btn btn-outline bg-paper btn-lg">
              Verify an invoice
            </Link>
          </div>
          <ul className="text-muted mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {[
              "No personal data on-chain",
              "Open-source SDK",
              "Confirms in under a second",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Icon name="check" className="text-brand h-4 w-4" />
                {t}
              </li>
            ))}
          </ul>
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
      className="card p-2 shadow-[var(--shadow-raised)]"
      aria-label="Example: a second lender is rejected"
    >
      <div className="bg-surface-alt border-line flex flex-wrap items-center justify-between gap-2 rounded-[18px] border px-4 py-3">
        <div>
          <div className="caption">Invoice hash</div>
          <div className="mt-0.5 font-mono text-sm">9f2c71e0…b8d4a41e</div>
        </div>
        <div className="text-right">
          <div className="caption">USD · due 15 Dec 2026</div>
          <div className="mt-0.5 text-sm font-semibold">12,500.00</div>
        </div>
      </div>
      <ol className="space-y-1 p-2 pt-3">
        <li className="ledger-row flex items-center justify-between gap-3 px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">Sealed and attested</div>
            <div className="text-muted text-xs">
              Supplier sealed it, verified buyer confirmed it is due
            </div>
          </div>
          <span className="badge badge-free">Sealed</span>
        </li>
        <li className="ledger-row flex items-center justify-between gap-3 px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">Lender A locks it</div>
            <div className="text-muted text-xs">
              09 Oct 2026 · 1 USDC-dev fee
            </div>
          </div>
          <span className="badge badge-locked">Financed</span>
        </li>
        <li className="ledger-row space-y-2 px-3 py-2.5">
          <div className="text-sm font-medium">Lender B tries to lock it</div>
          <div className="stamp py-3 text-sm" role="presentation">
            <div className="flex items-center gap-1.5 font-semibold">
              <Icon name="x" /> Rejected by the Selo program
            </div>
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

function Stats() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <dl className="card grid grid-cols-2 gap-y-8 p-0 py-8 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-col-reverse justify-end gap-2 px-6 ${i % 2 === 1 ? "border-line border-l" : ""} ${
              i === 2 ? "lg:border-line lg:border-l" : ""
            }`}
          >
            <dt className="caption">{s.label}</dt>
            <dd className="text-4xl font-semibold tracking-[-0.025em]">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Problem() {
  const rows: [string, string][] = [
    [
      "Each lender sees only its own book",
      "Every lender reads the same public record",
    ],
    [
      "A pledged invoice can be pledged again",
      "The second lock fails on-chain",
    ],
    [
      "Fake invoices pass with a forged confirmation",
      "Only the verified buyer can attest",
    ],
    [
      "Fraud surfaces after the money is gone",
      "The check happens before the money moves",
    ],
  ];
  return (
    <Section
      eyebrow="The problem"
      title="Lenders who finance invoices cannot see each other"
      intro={
        <>
          A supplier can pledge the same invoice to two lenders, or invent one
          and finance it several times. In the First Brands collapse,
          prosecutors allege fake invoices and collateral pledged two or three
          times over, with billions lost by creditors.
        </>
      }
    >
      <div className="card overflow-hidden p-0">
        <div className="border-line bg-surface-alt grid grid-cols-2 border-b">
          <div className="caption px-5 py-3">Without Selo</div>
          <div className="caption text-brand border-line border-l px-5 py-3">
            With Selo
          </div>
        </div>
        {rows.map(([before, after]) => (
          <div
            key={before}
            className="border-line grid grid-cols-2 border-b last:border-0"
          >
            <div className="text-muted flex items-start gap-2 px-5 py-4">
              <Icon name="x" className="text-ember mt-0.5 h-4 w-4 shrink-0" />
              {before}
            </div>
            <div className="border-line flex items-start gap-2 border-l px-5 py-4 font-medium">
              <Icon
                name="check"
                className="text-brand mt-0.5 h-4 w-4 shrink-0"
              />
              {after}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section
      band
      eyebrow="How it works"
      title="Four moments, each a Solana transaction"
      intro="Each one confirms in under a second. Try them in order with the demo wallets."
    >
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.who}>
            <Link
              href={s.href}
              className="card group block h-full transition-shadow hover:shadow-[var(--shadow-raised)]"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    i === 3
                      ? "text-ember bg-[#fff1f1]"
                      : "bg-brand-50 text-brand"
                  }`}
                >
                  {i + 1}
                </span>
                <Icon
                  name="arrow"
                  className="text-muted group-hover:text-ink h-4 w-4 transition-colors"
                />
              </div>
              <div className="text-muted mt-5">{s.who}</div>
              <div className="mt-0.5 text-base font-semibold">{s.title}</div>
              <p className="text-muted mt-2 leading-relaxed">{s.what}</p>
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Moment 5, computed with the real SDK: two spellings, one hash. */
function Retyped() {
  const canonical = canonicalize(TYPED[0].invoice);
  const hash = toHex(invoiceHash(TYPED[0].invoice));
  const same = TYPED.every((t) => canonicalize(t.invoice) === canonical);
  return (
    <Section
      eyebrow="Retyping does not help"
      title="Two spellings. One invoice. One hash."
      intro="Before hashing, Selo normalizes every field: case, spaces and punctuation in tax IDs and invoice numbers stop mattering. The second registration lands on the same address and fails."
    >
      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
        {TYPED.map((t, i) => (
          <div key={t.who} className="card">
            <div className="flex items-center justify-between">
              <span className="caption">{t.who}</span>
              <span
                className={`badge ${i === 0 ? "badge-free" : "text-ember bg-[#fff1f1]"}`}
              >
                {i === 0 ? "Sealed" : "Rejected"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {(
                [
                  ["Supplier", t.invoice.supplierTaxId],
                  ["Buyer", t.invoice.buyerTaxId],
                  ["Number", t.invoice.number],
                  ["Amount", String(t.invoice.amount)],
                  ["Currency", t.invoice.currency],
                  ["Due", t.invoice.dueDate],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-mono text-[13px] whitespace-pre">
                    {`"${v}"`}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <div className="card flex flex-col gap-4">
          <span className="caption">Canonical form, computed by the SDK</span>
          <div className="bg-surface-alt border-line rounded-[18px] border p-4 font-mono text-xs leading-relaxed break-all">
            {canonical}
          </div>
          <div>
            <span className="caption">sha256 → seal address</span>
            <div className="text-brand mt-1 font-mono text-xs font-medium break-all">
              {hash}
            </div>
          </div>
          {same && (
            <div className="stamp mt-auto py-3 text-sm">
              <div className="flex items-center gap-1.5 font-semibold">
                <Icon name="x" /> Second registration rejected
              </div>
              <div className="mt-0.5">This invoice is already sealed.</div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Guarantees() {
  return (
    <Section
      band
      eyebrow="Why it holds"
      title="Enforced by the program, not by promises"
      intro="Every rule below is checked on-chain on every transaction. The program is open source and covered by tests for each attack it blocks."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUARANTEES.map((g) => (
          <div key={g.title} className="card">
            <span className="bg-brand-50 text-brand flex h-9 w-9 items-center justify-center rounded-full">
              <Icon name={g.icon} className="h-[18px] w-[18px]" />
            </span>
            <h3 className="mt-4 text-base font-semibold">{g.title}</h3>
            <p className="text-muted mt-1.5 leading-relaxed">{g.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ForLenders() {
  return (
    <Section
      eyebrow="For lenders"
      title="One call in your credit flow"
      intro={
        <>
          Factoring firms and credit protocols add{" "}
          <code className="text-ink font-mono">checkInvoice()</code> before they
          fund. It hashes the invoice locally and reads its record in Selo:
          free, sealed, financed, closed or cancelled, plus whether its buyer is
          verified.
        </>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Code source={SNIPPET} />
        <div className="space-y-4">
          {[
            {
              k: "Business model",
              v: "A small fee per invoice locked, paid by the lender.",
            },
            {
              k: "Pricing assumption",
              v: "5 basis points of face value. In the demo: 1 USDC-dev.",
            },
            {
              k: "Why lenders pay",
              v: "The fee is far smaller than one double-financing loss, and every new lender makes the registry more valuable.",
            },
          ].map((row) => (
            <div key={row.k} className="card">
              <div className="caption">{row.k}</div>
              <p className="mt-1.5 text-base leading-relaxed">{row.v}</p>
            </div>
          ))}
          <a
            href={`${REPO}#integrating-checkinvoice`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
          >
            Read the SDK docs <Icon name="arrow" />
          </a>
        </div>
      </div>
    </Section>
  );
}

function OnChain() {
  const cols = [
    {
      title: "Public",
      tone: "badge-free",
      text: "The invoice hash, face amount, currency, due date, whether the buyer attested, and which lender locked it and when. That is what a lender needs to decide.",
    },
    {
      title: "Never stored",
      tone: "badge-soft",
      text: "Company names, tax IDs, descriptions and documents. They stay with the parties; only their canonical hash is published.",
    },
    {
      title: "Limits, stated plainly",
      tone: "badge-muted",
      text: "Tax IDs have little entropy, so someone who already knows both parties can test a guess. Selo only catches duplicates among lenders that check it, and a seal does not replace the assignment contract.",
    },
  ];
  return (
    <Section
      band
      eyebrow="Privacy"
      title="What goes on-chain, and what never does"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.title} className="card">
            <span className={`badge ${c.tone}`}>{c.title}</span>
            <p className="text-muted mt-3 leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Faq() {
  return (
    <Section eyebrow="Questions" title="Frequently asked">
      <div className="card divide-line divide-y p-0">
        {FAQ.map((f) => (
          <details key={f.q} className="faq group px-5">
            <summary className="flex items-center justify-between gap-4 py-4 text-base font-medium">
              {f.q}
              <Icon name="plus" className="chev text-muted h-4 w-4 shrink-0" />
            </summary>
            <p className="text-muted max-w-3xl pb-5 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Closing() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
      <div className="card relative overflow-hidden px-6 py-12 text-center sm:px-12">
        <div className="backdrop-grid pointer-events-none absolute inset-0" />
        <div className="relative">
          <h2 className="heading-2 mx-auto max-w-xl">
            Check before you finance.
          </h2>
          <p className="text-muted mx-auto mt-3 max-w-md text-base leading-relaxed">
            Seal an invoice, attest it, lock it, and watch the second lender get
            rejected. Real devnet transactions, under a minute.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/fornecedor" className="btn btn-brand btn-lg">
              Seal your first invoice <Icon name="arrow" />
            </Link>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline bg-paper btn-lg"
            >
              View the source
            </a>
          </div>
        </div>
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
      ? "text-muted"
      : m[2]
        ? "text-ink"
        : m[3]
          ? "text-brand font-medium"
          : "text-brand-600";
    parts.push(
      <span key={m.index} className={tone}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  parts.push(source.slice(last));

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-line bg-surface-alt flex items-center justify-between border-b px-5 py-3">
        <span className="text-muted font-mono text-xs">credit-check.ts</span>
        <span className="badge badge-soft">TypeScript</span>
      </div>
      <pre className="text-ink-soft overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
        <code>{parts}</code>
      </pre>
    </div>
  );
}
