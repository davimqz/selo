"use client";

import { type InvoiceForm, type Parsed, exampleForm } from "@/lib/invoice";

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
        <button
          type="button"
          className="text-muted underline underline-offset-2 hover:text-ink"
          onClick={() => onChange(exampleForm())}
        >
          Fill the example invoice
        </button>
        {!parsed.ok && parsed.error && (
          <span className="text-stamp">{parsed.error}</span>
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
    <div className="rounded-md bg-wash p-3 font-mono text-xs leading-relaxed">
      <div className="text-muted">
        canonical form (computed in your browser)
      </div>
      <div className="break-all">{canonical}</div>
      <div className="mt-2 text-muted">invoice hash = sha256(canonical)</div>
      <div className="break-all">{hash}</div>
    </div>
  );
}
