"use client";

import type { Address } from "@solana/kit";
import {
  type SealEntry,
  SealStatus,
  formatDate,
  listSeals,
  toHex,
} from "@selo/sdk";
import { useCallback, useEffect, useState } from "react";
import { explorerAddress, rpc } from "@/lib/config";
import { formatAmount, shortHash } from "@/lib/invoice";

const STATUS_TEXT: Record<SealStatus, string> = {
  [SealStatus.Sealed]: "Sealed",
  [SealStatus.Locked]: "Financed",
  [SealStatus.Released]: "Closed",
  [SealStatus.Cancelled]: "Cancelled",
};

const STATUS_TONE: Record<SealStatus, string> = {
  [SealStatus.Sealed]: "badge-free",
  [SealStatus.Locked]: "badge-locked",
  [SealStatus.Released]: "badge-muted",
  [SealStatus.Cancelled]: "badge-muted",
};

export function SealList({
  by,
  refresh = 0,
  action,
}: {
  by: { supplier: Address } | { buyer: Address };
  refresh?: number;
  action?: (seal: SealEntry, reload: () => void) => React.ReactNode;
}) {
  const [seals, setSeals] = useState<SealEntry[] | null>(null);
  const [error, setError] = useState(false);
  const key = "supplier" in by ? `s:${by.supplier}` : `b:${by.buyer}`;

  const load = useCallback(() => {
    listSeals(rpc, by)
      .then((list) => {
        setError(false);
        setSeals(list);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      });
    // `by` is described by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  if (error) {
    return (
      <p className="text-sm text-stamp">
        Could not load the registry.{" "}
        <button className="underline" onClick={load}>
          Retry
        </button>
      </p>
    );
  }
  if (!seals) return <p className="text-sm text-muted">Loading…</p>;
  if (seals.length === 0) {
    return (
      <p className="card text-sm text-muted">
        No invoices yet.{" "}
        {"supplier" in by
          ? "Seal one above and it shows up here."
          : "Invoices a supplier seals against this wallet show up here."}
      </p>
    );
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="bg-wash text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-2.5 pr-4 font-medium first:pl-6">Invoice hash</th>
            <th className="py-2.5 pr-4 font-medium first:pl-6">Amount</th>
            <th className="py-2.5 pr-4 font-medium first:pl-6">Due</th>
            <th className="py-2.5 pr-4 font-medium first:pl-6">Status</th>
            <th className="py-2.5 pr-4 font-medium first:pl-6">Attested</th>
            {action && <th className="py-2.5 pr-6" />}
          </tr>
        </thead>
        <tbody>
          {seals.map((s) => {
            const currency = new TextDecoder().decode(
              new Uint8Array(s.data.currency),
            );
            const hash = toHex(new Uint8Array(s.data.invoiceHash));
            return (
              <tr
                key={s.address}
                className="border-b border-line last:border-0"
              >
                <td className="py-3 pr-4 pl-6 font-mono text-xs">
                  <a
                    href={explorerAddress(s.address)}
                    target="_blank"
                    rel="noreferrer"
                    title={hash}
                    className="underline-offset-2 hover:underline"
                  >
                    {shortHash(hash)}
                  </a>
                  <button
                    type="button"
                    className="ml-2 font-sans font-medium text-brand hover:underline"
                    title="Copy the full hash"
                    onClick={() => navigator.clipboard?.writeText(hash)}
                  >
                    copy
                  </button>
                </td>
                <td className="py-3 pr-4">
                  {formatAmount(s.data.faceAmount, currency)}
                </td>
                <td className="py-3 pr-4">
                  {formatDate(new Date(Number(s.data.dueTs) * 1000))}
                </td>
                <td className="py-3 pr-4">
                  <span className={`badge ${STATUS_TONE[s.data.status]}`}>
                    {STATUS_TEXT[s.data.status]}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {s.data.buyerAttested ? "Yes" : "No"}
                </td>
                {action && (
                  <td className="py-3 pr-6 text-right">{action(s, load)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
