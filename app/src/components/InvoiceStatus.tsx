"use client";

import { type InvoiceCheck, formatDate } from "@selo/sdk";
import { explorerAddress } from "@/lib/config";
import { formatAmount } from "@/lib/invoice";

const LABEL: Record<InvoiceCheck["status"], { text: string; tone: string }> = {
  free: { text: "Not registered", tone: "text-free border-free" },
  sealed: { text: "Sealed — not financed", tone: "text-free border-free" },
  locked: { text: "Financed", tone: "text-stamp border-stamp" },
  released: { text: "Closed (paid)", tone: "text-muted border-line" },
  cancelled: { text: "Cancelled", tone: "text-muted border-line" },
};

export function InvoiceStatus({ check }: { check: InvoiceCheck }) {
  const label = LABEL[check.status];
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded border px-2 py-0.5 text-sm font-medium ${label.tone}`}
        >
          {label.text}
        </span>
        <a
          href={explorerAddress(check.seal)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-muted underline underline-offset-2"
        >
          seal account ↗
        </a>
      </div>
      {check.status === "free" ? (
        <p className="text-sm text-muted">
          No one has registered this invoice in Selo yet.
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {check.terms && (
            <>
              <dt className="text-muted">Amount</dt>
              <dd>
                {formatAmount(check.terms.faceAmount, check.terms.currency)}
              </dd>
              <dt className="text-muted">Due</dt>
              <dd>{formatDate(check.terms.dueDate)}</dd>
            </>
          )}
          <dt className="text-muted">Buyer attested</dt>
          <dd>{check.attested ? "Yes" : "Not yet"}</dd>
          {check.lender && (
            <>
              <dt className="text-muted">Financed by</dt>
              <dd>
                <strong>{check.lender.name}</strong>
                {check.lockedAt && ` on ${formatDate(check.lockedAt)}`}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
