import { describe, expect, it } from "vitest";
import {
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  SolanaError,
} from "@solana/kit";
import {
  describeSeloError,
  explainError,
  formatDate,
  seloErrorCode,
} from "../src/errors";
import {
  SELO_ERROR__INVOICE_ALREADY_LOCKED,
  SELO_ERROR__INVOICE_ALREADY_SEALED,
} from "../src/generated";

const custom = (code: number) =>
  new SolanaError(SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM, { code, index: 0 });

describe("program error translation", () => {
  it("finds the custom code inside nested causes", () => {
    const wrapped = new Error("simulation failed", {
      cause: new Error("transaction error", { cause: custom(6008) }),
    });
    expect(seloErrorCode(wrapped)).toBe(6008);
    expect(seloErrorCode(new Error("network down"))).toBeUndefined();
  });

  it("explains a duplicate seal", async () => {
    expect(await explainError(custom(SELO_ERROR__INVOICE_ALREADY_SEALED))).toBe(
      "This invoice is already registered in Selo. It cannot be registered twice.",
    );
  });

  it("names the lender and date for a rejected lock", () => {
    expect(
      describeSeloError(SELO_ERROR__INVOICE_ALREADY_LOCKED, {
        lenderName: "Lender A",
        lockedAt: new Date("2027-01-15T08:00:00Z"),
      }),
    ).toBe(
      "Already financed by Lender A on 15 Jan 2027. It cannot be financed twice.",
    );
  });

  it("falls back to a generic lock message without details", () => {
    expect(describeSeloError(SELO_ERROR__INVOICE_ALREADY_LOCKED)).toBe(
      "Already financed by another lender. It cannot be financed twice.",
    );
  });

  it("never shows a raw error", async () => {
    expect(describeSeloError(9999)).toBe(
      "The transaction was rejected (code 9999).",
    );
    expect(await explainError(new Error("User rejected the request."))).toBe(
      "The request was cancelled in the wallet.",
    );
    expect(await explainError(new Error("0x1771 AnchorError ..."))).toBe(
      "The transaction failed. Please try again.",
    );
  });

  it("formats dates in UTC without ambiguity", () => {
    expect(formatDate(new Date("2027-04-15T00:00:00Z"))).toBe("15 Apr 2027");
  });
});
