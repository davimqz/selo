"use client";

import { type Invoice, type InvoiceCheck, checkInvoice } from "@selo/sdk";
import { useState } from "react";
import { rpc } from "@/lib/config";
import { EMPTY_FORM, parseForm } from "@/lib/invoice";
import { InvoiceFields } from "./InvoiceFields";

export type InvoiceRef = Invoice | string;

/**
 * Find an invoice by its data (hashed in the browser) or by a pasted hash,
 * then run checkInvoice() — the call a lender puts in its credit flow.
 */
export function InvoiceLookup({
  onResult,
}: {
  onResult: (ref: InvoiceRef, check: InvoiceCheck) => void;
}) {
  const [mode, setMode] = useState<"data" | "hash">("data");
  const [form, setForm] = useState(EMPTY_FORM);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const parsed = parseForm(form);
  const hashOk = /^(0x)?[0-9a-fA-F]{64}$/.test(hash.trim());
  const ready = mode === "data" ? parsed.ok : hashOk;

  async function run() {
    const ref: InvoiceRef | undefined =
      mode === "hash" ? hash.trim() : parsed.ok ? parsed.invoice : undefined;
    if (!ref) return;
    setBusy(true);
    setError(undefined);
    try {
      onResult(ref, await checkInvoice(rpc, ref));
    } catch (err) {
      console.error(err);
      setError("Could not reach the registry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4">
      <div className="segmented">
        {(["data", "hash"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {m === "data" ? "Invoice data" : "Invoice hash"}
          </button>
        ))}
      </div>
      {mode === "data" ? (
        <InvoiceFields form={form} onChange={setForm} parsed={parsed} />
      ) : (
        <label className="field">
          Invoice hash (64 hex characters)
          <input
            className="font-mono"
            value={hash}
            spellCheck={false}
            onChange={(e) => setHash(e.target.value)}
          />
        </label>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready || busy}
          onClick={run}
        >
          {busy ? "Checking…" : "Check registry"}
        </button>
        {error && (
          <span className="text-stamp text-sm font-medium">{error}</span>
        )}
      </div>
    </section>
  );
}
