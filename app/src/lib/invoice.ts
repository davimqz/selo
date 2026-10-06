import {
  type Invoice,
  InvalidInvoiceError,
  canonicalize,
  invoiceHash,
  toHex,
} from "@selo/sdk";

/** What the user types. `amount` is in major units ("12,500.00"). */
export interface InvoiceForm {
  supplierTaxId: string;
  buyerTaxId: string;
  number: string;
  amount: string;
  currency: string;
  dueDate: string;
}

export const EMPTY_FORM: InvoiceForm = {
  supplierTaxId: "",
  buyerTaxId: "",
  number: "",
  amount: "",
  currency: "USD",
  dueDate: "",
};

/** The demo invoice. Due in 90 days so it is always in the future. */
export function exampleForm(): InvoiceForm {
  const due = new Date(Date.now() + 90 * 86_400_000);
  return {
    supplierTaxId: "DE 811 907 980",
    buyerTaxId: "US 94-1081436",
    number: "INV-2026-0042",
    amount: "12,500.00",
    currency: "USD",
    dueDate: due.toISOString().slice(0, 10),
  };
}

// ISO 4217 currencies without minor units that a demo might plausibly use.
const ZERO_DECIMALS = new Set(["JPY", "KRW", "CLP", "VND", "ISK", "UGX"]);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMALS.has(currency.trim().toUpperCase()) ? 0 : 2;
}

/** "12,500.00" USD -> "1250000" (minor units). */
export function toMinorUnits(amount: string, currency: string): string {
  const decimals = currencyDecimals(currency);
  const clean = amount.trim().replace(/[,\s_]/g, "");
  const m = /^(\d+)(?:\.(\d*))?$/.exec(clean);
  if (!m || (m[2] ?? "").length > decimals) {
    throw new InvalidInvoiceError(
      "amount",
      decimals === 0
        ? "Amount must be a whole number."
        : `Amount must have at most ${decimals} decimal places.`,
    );
  }
  const minor = BigInt(m[1] + (m[2] ?? "").padEnd(decimals, "0"));
  return minor.toString();
}

export function formatAmount(minor: bigint, currency: string): string {
  const decimals = currencyDecimals(currency);
  const unit = 10n ** BigInt(decimals);
  const whole = (minor / unit).toLocaleString("en-US");
  const frac = decimals
    ? "." + (minor % unit).toString().padStart(decimals, "0")
    : "";
  return `${currency} ${whole}${frac}`;
}

export function toInvoice(form: InvoiceForm): Invoice {
  return {
    supplierTaxId: form.supplierTaxId,
    buyerTaxId: form.buyerTaxId,
    number: form.number,
    amount: toMinorUnits(form.amount, form.currency),
    currency: form.currency,
    dueDate: form.dueDate,
  };
}

export type Parsed =
  | { ok: true; invoice: Invoice; canonical: string; hash: string }
  | { ok: false; error?: string };

/** Live parse for the form: canonical string and hash, or the first error. */
export function parseForm(form: InvoiceForm): Parsed {
  const filled = Object.values(form).every((v) => v.trim() !== "");
  if (!filled) return { ok: false };
  try {
    const invoice = toInvoice(form);
    return {
      ok: true,
      invoice,
      canonical: canonicalize(invoice),
      hash: toHex(invoiceHash(invoice)),
    };
  } catch (err) {
    if (err instanceof InvalidInvoiceError) {
      const own = err.field === "amount" && /^Amount/.test(err.message);
      return {
        ok: false,
        error: own ? err.message : (FIELD_ERRORS[err.field] ?? err.message),
      };
    }
    throw err;
  }
}

const FIELD_ERRORS: Partial<Record<keyof Invoice, string>> = {
  buyerTaxId: "Buyer tax ID needs at least one letter or digit.",
  supplierTaxId: "Supplier tax ID needs at least one letter or digit.",
  number: "Invoice number cannot contain '|' or control characters.",
  amount: "Amount must be a positive number.",
  currency: "Currency must be a 3-letter ISO 4217 code (e.g. USD).",
  dueDate: "Due date must be a valid date.",
};

export function shortHash(hex: string): string {
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
