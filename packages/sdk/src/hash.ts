/**
 * Canonical invoice hash (spec: CLAUDE.md section 5).
 *
 *   v1|<buyer tax id>|<supplier tax id>|<invoice number>|<amount>|<currency>|<due date>
 *   invoice_hash = sha256(utf8(canonical string))
 *
 * Two parties typing the same invoice must reach the same hash: the Seal PDA
 * ["seal", hash] is what makes an invoice sealable only once. The hash is
 * deliberately unsalted so that every lender derives the same address.
 */
import { sha256 } from "@noble/hashes/sha2.js";

export const INVOICE_HASH_VERSION = "v1";

export interface Invoice {
  /** Buyer's tax ID, any formatting ("12.345.678/0001-90", "gb 123 456 789"). */
  buyerTaxId: string;
  /** Supplier's tax ID, any formatting. */
  supplierTaxId: string;
  /** Invoice number as printed. */
  number: string;
  /** Face amount in minor units (cents for USD): an integer, not a decimal. */
  amount: bigint | number | string;
  /** ISO 4217 code, e.g. "USD". */
  currency: string;
  /** Due date as YYYY-MM-DD. */
  dueDate: string;
}

export class InvalidInvoiceError extends Error {
  readonly field: keyof Invoice;

  constructor(field: keyof Invoice, message: string) {
    super(message);
    this.name = "InvalidInvoiceError";
    this.field = field;
  }
}

/** Letters and digits only, uppercase. */
export function canonicalTaxId(
  raw: string,
  field: "buyerTaxId" | "supplierTaxId" = "buyerTaxId",
): string {
  const value = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (value.length === 0) {
    throw new InvalidInvoiceError(field, `invalid tax ID: "${raw}"`);
  }
  return value;
}

/** Trim, uppercase, remove internal whitespace. */
export function canonicalNumber(raw: string): string {
  const value = raw.normalize("NFC").trim().toUpperCase().replace(/\s+/g, "");
  // "|" is the field separator; control characters are never part of a number.
  if (value.length === 0 || /[|\p{Cc}]/u.test(value)) {
    throw new InvalidInvoiceError("number", `invalid invoice number: "${raw}"`);
  }
  return value;
}

/** Positive integer in minor units, no leading zeros. */
export function canonicalAmount(raw: bigint | number | string): string {
  let value: bigint;
  if (typeof raw === "bigint") {
    value = raw;
  } else if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw)) {
      throw new InvalidInvoiceError(
        "amount",
        `amount must be an integer in minor units: ${raw}`,
      );
    }
    value = BigInt(raw);
  } else {
    const s = raw.trim();
    if (!/^\d+$/.test(s)) {
      throw new InvalidInvoiceError(
        "amount",
        `amount must be an integer in minor units: "${raw}"`,
      );
    }
    value = BigInt(s);
  }
  if (value <= 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new InvalidInvoiceError("amount", `amount out of range: ${value}`);
  }
  return value.toString();
}

/** Three uppercase letters (ISO 4217). */
export function canonicalCurrency(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new InvalidInvoiceError(
      "currency",
      `invalid ISO 4217 currency: "${raw}"`,
    );
  }
  return value;
}

/** A real calendar date as YYYY-MM-DD. */
export function canonicalDueDate(raw: string): string {
  const value = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !date || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidInvoiceError(
      "dueDate",
      `due date must be YYYY-MM-DD: "${raw}"`,
    );
  }
  return value;
}

export function canonicalize(invoice: Invoice): string {
  return [
    INVOICE_HASH_VERSION,
    canonicalTaxId(invoice.buyerTaxId, "buyerTaxId"),
    canonicalTaxId(invoice.supplierTaxId, "supplierTaxId"),
    canonicalNumber(invoice.number),
    canonicalAmount(invoice.amount),
    canonicalCurrency(invoice.currency),
    canonicalDueDate(invoice.dueDate),
  ].join("|");
}

export function invoiceHash(invoice: Invoice): Uint8Array {
  return sha256(new TextEncoder().encode(canonicalize(invoice)));
}

/**
 * Hash of a company's tax ID, the seed of its verified `Buyer` account:
 *
 *   sha256(utf8("v1|party|" + canonical tax ID))
 *
 * A lender holding the invoice derives the buyer's account from it and checks
 * that the wallet that attested is the company named on the invoice.
 */
export function partyIdHash(taxId: string): Uint8Array {
  return sha256(
    new TextEncoder().encode(
      `${INVOICE_HASH_VERSION}|party|${canonicalTaxId(taxId)}`,
    ),
  );
}

/** The fields `seal_invoice` stores in clear, derived from the same invoice. */
export function sealArgs(invoice: Invoice) {
  const currency = canonicalCurrency(invoice.currency);
  return {
    invoiceHash: invoiceHash(invoice),
    faceAmount: BigInt(canonicalAmount(invoice.amount)),
    currency: new TextEncoder().encode(currency),
    /** Due date at 00:00:00 UTC, in Unix seconds. */
    dueTs: BigInt(
      Date.parse(`${canonicalDueDate(invoice.dueDate)}T00:00:00Z`) / 1000,
    ),
  };
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error(`invoice hash must be 32 bytes of hex: "${hex}"`);
  }
  return Uint8Array.from(clean.match(/../g)!, (b) => parseInt(b, 16));
}
