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
          className="text-brand font-medium hover:underline"
          onClick={() => onChange(exampleForm())}
        >
          Fill the example invoice
        </button>
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
    <div className="overflow-hidden rounded-xl bg-[var(--gray-950)] text-xs leading-relaxed">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[#a8a9b4]">
        <span>Computed in your browser</span>
        <span className="text-[#8f7aff]">only the hash goes on-chain</span>
      </div>
      <div className="space-y-3 p-4 font-mono">
        <div>
          <div className="text-[#a8a9b4]">canonical</div>
          <div className="break-all text-white">{canonical}</div>
        </div>
        <div>
          <div className="text-[#a8a9b4]">sha256(canonical)</div>
          <div className="break-all text-[#8f7aff]">{hash}</div>
        </div>
      </div>
    </div>
  );
}
