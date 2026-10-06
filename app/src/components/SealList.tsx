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
    return <p className="text-sm text-muted">No invoices yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-4 font-normal">Invoice hash</th>
            <th className="py-2 pr-4 font-normal">Amount</th>
            <th className="py-2 pr-4 font-normal">Due</th>
            <th className="py-2 pr-4 font-normal">Status</th>
            <th className="py-2 pr-4 font-normal">Attested</th>
            {action && <th className="py-2 font-normal" />}
          </tr>
        </thead>
        <tbody>
          {seals.map((s) => {
            const currency = new TextDecoder().decode(
              new Uint8Array(s.data.currency),
            );
            const hash = toHex(new Uint8Array(s.data.invoiceHash));
            return (
              <tr key={s.address} className="border-b border-line">
                <td className="py-2 pr-4 font-mono text-xs">
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
                    className="ml-2 text-muted hover:text-ink"
                    title="Copy the full hash"
                    onClick={() => navigator.clipboard?.writeText(hash)}
                  >
                    copy
                  </button>
                </td>
                <td className="py-2 pr-4">
                  {formatAmount(s.data.faceAmount, currency)}
                </td>
                <td className="py-2 pr-4">
                  {formatDate(new Date(Number(s.data.dueTs) * 1000))}
                </td>
                <td className="py-2 pr-4">{STATUS_TEXT[s.data.status]}</td>
                <td className="py-2 pr-4">
                  {s.data.buyerAttested ? "Yes" : "No"}
                </td>
                {action && <td className="py-2">{action(s, load)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
