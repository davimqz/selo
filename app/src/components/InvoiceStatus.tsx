"use client";

import { type InvoiceCheck, formatDate } from "@selo/sdk";
import { explorerAddress } from "@/lib/config";
import { formatAmount } from "@/lib/invoice";

const LABEL: Record<InvoiceCheck["status"], { text: string; tone: string }> = {
  free: { text: "Not registered", tone: "badge-muted" },
  sealed: { text: "Sealed — not financed", tone: "badge-free" },
  locked: { text: "Financed", tone: "badge-locked" },
  released: { text: "Closed (paid)", tone: "badge-muted" },
  cancelled: { text: "Cancelled", tone: "badge-muted" },
};

function BuyerIdentity({
  buyer,
}: {
  buyer: NonNullable<InvoiceCheck["buyer"]>;
}) {
  switch (buyer.verification) {
    case "verified":
      return (
        <span className="text-free font-medium">Verified: {buyer.name}</span>
      );
    case "mismatch":
      return (
        <span className="text-stamp font-medium">
          Not the company on the invoice ({buyer.name} is verified with another
          wallet). Do not finance.
        </span>
      );
    case "unverified":
      return (
        <span className="text-stamp">
          The company on the invoice is not verified in Selo
        </span>
      );
    default:
      return (
        <span className="text-muted">
          Look the invoice up by its data to check
        </span>
      );
  }
}

export function InvoiceStatus({ check }: { check: InvoiceCheck }) {
  const label = LABEL[check.status];
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`badge ${label.tone}`}>{label.text}</span>
        <a
          href={explorerAddress(check.seal)}
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:text-ink text-xs font-medium"
        >
          Seal account on Explorer ↗
        </a>
      </div>
      {check.status === "free" ? (
        <p className="text-muted text-sm">
          No one has registered this invoice in Selo yet.
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {check.terms && (
            <>
              <dt className="text-muted">Amount</dt>
              <dd className="font-medium">
                {formatAmount(check.terms.faceAmount, check.terms.currency)}
              </dd>
              <dt className="text-muted">Due</dt>
              <dd>{formatDate(check.terms.dueDate)}</dd>
            </>
          )}
          <dt className="text-muted">Buyer identity</dt>
          <dd>{check.buyer && <BuyerIdentity buyer={check.buyer} />}</dd>
          <dt className="text-muted">Buyer attested</dt>
          <dd>{check.attested ? "Yes" : "Not yet"}</dd>
          {check.lender && (
            <>
              <dt className="text-muted">Financed by</dt>
              <dd>
                <strong className="font-semibold">{check.lender.name}</strong>
                {check.lockedAt && ` on ${formatDate(check.lockedAt)}`}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
