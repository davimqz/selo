import { describe, expect, it } from "vitest";
import {
  DocType,
  InvalidDocumentFieldError,
  canonicalIssuer,
  canonicalNumber,
  docHash,
  docHashPreimage,
  toHex,
} from "@selo/sdk";

const bl = (issuer: string, number: string) =>
  toHex(docHash({ docType: DocType.BillOfLading, issuer, number }));

describe("document hash canonicalization", () => {
  it("normalizes B/L number formatting", () => {
    expect(canonicalNumber("MAEU-123 456")).toBe("MAEU123456");
    expect(canonicalNumber("maeu123456")).toBe("MAEU123456");
    expect(canonicalNumber(" maeu.123.456 ")).toBe("MAEU123456");
    expect(bl("MAEU", "MAEU-123 456")).toBe(bl("maeu", "maeu123456"));
  });

  it("normalizes CNPJ for invoices and CPRs", () => {
    expect(
      canonicalIssuer(DocType.CommercialInvoice, "12.345.678/0001-90"),
    ).toBe("12345678000190");
    const a = docHash({
      docType: DocType.Cpr,
      issuer: "12.345.678/0001-90",
      number: "CPR-2026/0042",
    });
    const b = docHash({
      docType: DocType.Cpr,
      issuer: "12345678000190",
      number: "cpr2026/0042",
    });
    expect(toHex(a)).toBe(toHex(b));
  });

  it("separates document types and fields", () => {
    const invoice = docHash({
      docType: DocType.CommercialInvoice,
      issuer: "12345678000190",
      number: "123",
    });
    const cpr = docHash({
      docType: DocType.Cpr,
      issuer: "12345678000190",
      number: "123",
    });
    expect(toHex(invoice)).not.toBe(toHex(cpr));
    // Length prefixes: issuer/number boundaries cannot be shifted.
    expect(bl("MAE", "U123")).not.toBe(bl("MAEU", "123"));
  });

  it("pins the v1 preimage layout and hash", () => {
    const fields = {
      docType: DocType.BillOfLading,
      issuer: "MAEU",
      number: "MAEU-123 456",
    };
    const preimage = new TextDecoder().decode(docHashPreimage(fields));
    expect(preimage).toBe("selo:doc:v1\u0000\u0004MAEU\u000aMAEU123456");
    expect(toHex(docHash(fields))).toBe(PINNED_BL_HASH);
  });

  it("rejects invalid fields", () => {
    const bad = [
      () => canonicalNumber(""),
      () => canonicalNumber(" - . "),
      () => canonicalNumber("MAEU_123"),
      () => canonicalNumber("A".repeat(65)),
      () => canonicalIssuer(DocType.BillOfLading, "MAEU1"),
      () => canonicalIssuer(DocType.BillOfLading, "MAERSK"),
      () => canonicalIssuer(DocType.CommercialInvoice, "1234567800019"),
      () => canonicalIssuer(DocType.Cpr, "12.345.678/0001-9A"),
    ];
    for (const fn of bad) expect(fn).toThrow(InvalidDocumentFieldError);
  });
});

// sha256("selo:doc:v1" || 0x00 || 0x04 "MAEU" || 0x0a "MAEU123456"), cross-checked with node:crypto.
const PINNED_BL_HASH =
  "750efa0bd35c9b6bbfadda160686e46c3d35d18bdc0c897e91c2ce3cfde1f568";
