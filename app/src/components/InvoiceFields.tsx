"use client";

import { type InvoiceForm, type Parsed, exampleForm } from "@/lib/invoice";
import { freshDemoInvoice, retyped, useDemo } from "./Demo";

const FIELDS: {
  key: keyof InvoiceForm;
  label: string;
  placeholder?: string;
  type?: string;
}[] = [
  {
    key: "supplierTaxId",
    label: "Supplier tax ID",
    placeholder: "DE 811 907 980",
  },
  { key: "buyerTaxId", label: "Buyer tax ID", placeholder: "US 94-1081436" },
  { key: "number", label: "Invoice number", placeholder: "INV-2026-0042" },
  { key: "amount", label: "Face amount", placeholder: "12,500.00" },
  { key: "currency", label: "Currency (ISO 4217)", placeholder: "USD" },
  { key: "dueDate", label: "Due date", type: "date" },
];

export function InvoiceFields({
  form,
  onChange,
  parsed,
}: {
  form: InvoiceForm;
  onChange: (form: InvoiceForm) => void;
  parsed: Parsed;
}) {
  const demo = useDemo();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            {f.label}
            <input
              type={f.type ?? "text"}
              value={form[f.key]}
              placeholder={f.placeholder}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => onChange({ ...form, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {demo.active ? (
          <>
            {demo.active.role === "supplier" && (
              <button
                type="button"
                className="text-brand font-medium hover:underline"
                onClick={() => onChange(freshDemoInvoice())}
              >
                New demo invoice
              </button>
            )}
            {demo.invoice && (
              <button
                type="button"
                className="text-brand font-medium hover:underline"
                onClick={() => onChange(demo.invoice!)}
              >
                Use the sealed demo invoice
              </button>
            )}
            {demo.invoice && demo.active.role === "supplier" && (
              <button
                type="button"
                className="text-brand font-medium hover:underline"
                onClick={() => onChange(retyped(demo.invoice!))}
              >
                Same invoice, typed differently
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="text-brand font-medium hover:underline"
            onClick={() => onChange(exampleForm())}
          >
            Fill the example invoice
          </button>
        )}
        {!parsed.ok && parsed.error && (
          <span className="text-stamp font-medium">{parsed.error}</span>
        )}
      </div>
      {parsed.ok && (
        <HashPreview canonical={parsed.canonical} hash={parsed.hash} />
      )}
    </div>
  );
}

export function HashPreview({
  canonical,
  hash,
}: {
  canonical: string;
  hash: string;
}) {
  return (
    <div className="border-line bg-surface-alt overflow-hidden rounded-[18px] border text-xs leading-relaxed">
      <div className="border-line text-muted flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <span>Computed in your browser</span>
        <span className="badge badge-free">only the hash goes on-chain</span>
      </div>
      <div className="space-y-3 p-4 font-mono">
        <div>
          <div className="text-muted">canonical</div>
          <div className="text-ink break-all">{canonical}</div>
        </div>
        <div>
          <div className="text-muted">sha256(canonical)</div>
          <div className="text-brand break-all font-medium">{hash}</div>
        </div>
      </div>
    </div>
  );
}
