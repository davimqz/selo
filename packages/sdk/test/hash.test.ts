import { describe, expect, it } from "vitest";
import {
  type Invoice,
  InvalidInvoiceError,
  canonicalize,
  fromHex,
  invoiceHash,
  partyIdHash,
  sealArgs,
  toHex,
} from "../src/hash";

const BASE: Invoice = {
  buyerTaxId: "BUYER-001",
  supplierTaxId: "SUP-042",
  number: "INV-2026-0001",
  amount: 1_250_000n,
  currency: "USD",
  dueDate: "2026-12-31",
};

// Pinned: changing it breaks every seal already on-chain. Bump the version instead.
const GOLDEN_STRING = "v1|BUYER001|SUP042|INV-2026-0001|1250000|USD|2026-12-31";
const GOLDEN_HASH =
  "0030a58be54fb0580e969f099ab4ac2d9b7a618389f29f56f79a03b09424644c";

const hex = (inv: Invoice) => toHex(invoiceHash(inv));

describe("canonical invoice hash v1", () => {
  it("matches the golden vector", () => {
    expect(canonicalize(BASE)).toBe(GOLDEN_STRING);
    expect(hex(BASE)).toBe(GOLDEN_HASH);
  });

  it.each<[string, Partial<Invoice>]>([
    [
      "lowercase everywhere",
      {
        buyerTaxId: "buyer-001",
        supplierTaxId: "sup-042",
        number: "inv-2026-0001",
        currency: "usd",
      },
    ],
    [
      "tax ID punctuation and spaces",
      { buyerTaxId: " BUYER 001 ", supplierTaxId: "S.U.P/042" },
    ],
    [
      "spaces around and inside the number",
      { number: "  INV - 2026 - 0001  " },
    ],
    ["tabs and newlines in the number", { number: "INV-2026-\t0001\n" }],
    ["amount as a number", { amount: 1_250_000 }],
    ["amount as a string with leading zeros", { amount: " 0001250000 " }],
    ["currency with spaces", { currency: " usd " }],
    ["due date with spaces", { dueDate: " 2026-12-31 " }],
  ])("same hash: %s", (_, change) => {
    expect(hex({ ...BASE, ...change })).toBe(GOLDEN_HASH);
  });

  it.each<[string, Partial<Invoice>]>([
    ["buyer", { buyerTaxId: "BUYER-002" }],
    ["supplier", { supplierTaxId: "SUP-043" }],
    ["number", { number: "INV-2026-0002" }],
    ["amount", { amount: 1_250_001n }],
    ["currency", { currency: "EUR" }],
    ["due date", { dueDate: "2027-01-01" }],
    [
      "buyer and supplier swapped",
      { buyerTaxId: "SUP-042", supplierTaxId: "BUYER-001" },
    ],
    // Only whitespace is dropped from the number; other characters are significant.
    ["hyphens removed from the number", { number: "INV20260001" }],
  ])("different hash: %s", (_, change) => {
    expect(hex({ ...BASE, ...change })).not.toBe(GOLDEN_HASH);
  });

  it.each<[keyof Invoice, Partial<Invoice>]>([
    ["buyerTaxId", { buyerTaxId: " -./ " }],
    ["supplierTaxId", { supplierTaxId: "" }],
    ["number", { number: "   " }],
    ["number", { number: "INV|1" }],
    ["amount", { amount: 0n }],
    ["amount", { amount: -5 }],
    ["amount", { amount: "12.50" }],
    ["amount", { amount: 1.5 }],
    ["amount", { amount: 2n ** 64n }],
    ["currency", { currency: "US" }],
    ["currency", { currency: "USDT" }],
    ["currency", { currency: "U$D" }],
    ["dueDate", { dueDate: "31/12/2026" }],
    ["dueDate", { dueDate: "2026-02-30" }],
    ["dueDate", { dueDate: "2026-1-5" }],
  ])("rejects invalid %s: %o", (field, change) => {
    const call = () => canonicalize({ ...BASE, ...change });
    expect(call).toThrow(InvalidInvoiceError);
    try {
      call();
    } catch (e) {
      expect((e as InvalidInvoiceError).field).toBe(field);
    }
  });

  it("sealArgs carries the same hash and the clear-text fields", () => {
    const args = sealArgs({ ...BASE, currency: "usd", amount: "1250000" });
    expect(toHex(args.invoiceHash)).toBe(GOLDEN_HASH);
    expect(args.faceAmount).toBe(1_250_000n);
    expect(Array.from(args.currency)).toEqual([0x55, 0x53, 0x44]);
    expect(args.dueTs).toBe(BigInt(Date.UTC(2026, 11, 31) / 1000));
  });

  it("round-trips hex", () => {
    expect(toHex(fromHex(GOLDEN_HASH))).toBe(GOLDEN_HASH);
    expect(toHex(fromHex(`0x${GOLDEN_HASH.toUpperCase()}`))).toBe(GOLDEN_HASH);
    expect(() => fromHex("abc")).toThrow();
  });
});

describe("party ID hash v1", () => {
  // Pinned: it seeds every verified Buyer account on-chain.
  const GOLDEN_PARTY =
    "59bd1717e1644f5880f0f30270b3047d23b89049b429739d08a36197c2063189";

  it.each(["BUYER-001", "buyer 001", " B.U.Y.E.R/001 "])(
    "same hash for %o",
    (taxId) => {
      expect(toHex(partyIdHash(taxId))).toBe(GOLDEN_PARTY);
    },
  );

  it("differs from the invoice hash domain and from other companies", () => {
    expect(toHex(partyIdHash("BUYER-002"))).not.toBe(GOLDEN_PARTY);
    expect(toHex(partyIdHash("BUYER-001"))).not.toBe(GOLDEN_HASH);
  });

  it("rejects an empty tax ID", () => {
    expect(() => partyIdHash(" -./ ")).toThrow(InvalidInvoiceError);
  });
});
