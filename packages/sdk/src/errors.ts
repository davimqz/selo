/**
 * Turns failed Selo transactions into messages a user can read. No raw Anchor
 * error should ever reach the UI.
 */
import {
  type GetAccountInfoApi,
  type ReadonlyUint8Array,
  type Rpc,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  isSolanaError,
} from "@solana/kit";
import { checkInvoice, toInvoiceHash } from "./check";
import {
  SELO_ERROR__ALREADY_ATTESTED,
  SELO_ERROR__BUYER_MISMATCH,
  SELO_ERROR__BUYER_NOT_VERIFIED,
  SELO_ERROR__DUE_DATE_IN_PAST,
  SELO_ERROR__INVALID_AMOUNT,
  SELO_ERROR__INVALID_BUYER,
  SELO_ERROR__INVALID_BUYER_NAME,
  SELO_ERROR__INVALID_CURRENCY,
  SELO_ERROR__INVALID_FEE_MINT,
  SELO_ERROR__INVALID_LENDER_NAME,
  SELO_ERROR__INVALID_STATUS,
  SELO_ERROR__INVOICE_ALREADY_LOCKED,
  SELO_ERROR__INVOICE_ALREADY_SEALED,
  SELO_ERROR__LENDER_INACTIVE,
  SELO_ERROR__LOCK_FEE_TOO_HIGH,
  SELO_ERROR__MATH_OVERFLOW,
  SELO_ERROR__NOT_ATTESTED,
  SELO_ERROR__NOT_LOCK_HOLDER,
  SELO_ERROR__NOT_UPGRADE_AUTHORITY,
  SELO_ERROR__PAUSED,
} from "./generated";
import type { Invoice } from "./hash";

const MESSAGES: Record<number, string> = {
  [SELO_ERROR__INVALID_AMOUNT]: "The face amount must be greater than zero.",
  [SELO_ERROR__INVALID_STATUS]:
    "This invoice is not in a state that allows this action.",
  [SELO_ERROR__MATH_OVERFLOW]: "Amount too large.",
  [SELO_ERROR__NOT_UPGRADE_AUTHORITY]:
    "Only the program's upgrade authority can initialize the registry.",
  [SELO_ERROR__LOCK_FEE_TOO_HIGH]: "The lock fee is above the maximum.",
  [SELO_ERROR__INVALID_FEE_MINT]: "The fee token must have 6 decimals.",
  [SELO_ERROR__INVALID_LENDER_NAME]:
    "Lender name must be 1 to 32 characters long.",
  [SELO_ERROR__PAUSED]: "The registry is paused.",
  [SELO_ERROR__INVOICE_ALREADY_SEALED]:
    "This invoice is already registered in Selo. It cannot be registered twice.",
  [SELO_ERROR__DUE_DATE_IN_PAST]: "The due date must be in the future.",
  [SELO_ERROR__INVALID_CURRENCY]:
    "The currency must be a 3-letter ISO 4217 code.",
  [SELO_ERROR__INVALID_BUYER]:
    "The buyer must be a different wallet from the supplier.",
  [SELO_ERROR__INVOICE_ALREADY_LOCKED]:
    "Already financed by another lender. It cannot be financed twice.",
  [SELO_ERROR__NOT_ATTESTED]:
    "The buyer has not confirmed this invoice yet. It cannot be financed.",
  [SELO_ERROR__ALREADY_ATTESTED]: "You have already confirmed this invoice.",
  [SELO_ERROR__LENDER_INACTIVE]: "This lender is not active in Selo.",
  [SELO_ERROR__NOT_LOCK_HOLDER]:
    "Only the lender that financed this invoice can release it.",
  [SELO_ERROR__INVALID_BUYER_NAME]:
    "Buyer name must be 1 to 32 characters long.",
  [SELO_ERROR__BUYER_NOT_VERIFIED]:
    "The buyer's identity is not verified in Selo. It cannot confirm or be financed.",
  [SELO_ERROR__BUYER_MISMATCH]:
    "The wallet that confirmed this invoice is not the verified company named on it. Do not finance.",
};

/** Anchor framework and SPL Token errors a user can hit through the app. */
const FRAMEWORK_MESSAGES: Record<number, string> = {
  // SPL Token: InsufficientFunds (lock fee).
  1: "Not enough USDC-dev in this wallet to pay the lock fee.",
  2001: "This wallet is not allowed to do this.",
  2003: "This wallet is not allowed to do this.",
  2006: "The invoice account does not match the invoice data.",
  2014: "Wrong token for the lock fee.",
  2015: "The token account does not belong to this wallet.",
  3012: "Not registered in Selo: this lender, or the buyer on the invoice, is not verified.",
};

/** The custom program error code inside a (possibly nested) Kit error. */
export function seloErrorCode(error: unknown): number | undefined {
  for (let e: unknown = error, depth = 0; e && depth < 10; depth++) {
    if (isSolanaError(e, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
      return e.context.code;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** "15 Jan 2027": unambiguous for an international audience. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function describeSeloError(
  code: number,
  details?: { lenderName?: string; lockedAt?: Date },
): string {
  if (code === SELO_ERROR__INVOICE_ALREADY_LOCKED && details?.lenderName) {
    const when = details.lockedAt ? ` on ${formatDate(details.lockedAt)}` : "";
    return `Already financed by ${details.lenderName}${when}. It cannot be financed twice.`;
  }
  return (
    MESSAGES[code] ??
    FRAMEWORK_MESSAGES[code] ??
    `The transaction was rejected (code ${code}).`
  );
}

/**
 * Readable message for any error from sending a Selo transaction. For a
 * rejected lock, pass the invoice so it can say who financed it and when.
 */
export async function explainError(
  error: unknown,
  context?: {
    rpc: Rpc<GetAccountInfoApi>;
    invoice: Invoice | ReadonlyUint8Array | string;
  },
): Promise<string> {
  const code = seloErrorCode(error);
  if (code === undefined) {
    const message = error instanceof Error ? error.message : String(error);
    if (/rejected the request|user rejected/i.test(message)) {
      return "The request was cancelled in the wallet.";
    }
    if (/insufficient (funds|lamports)/i.test(message)) {
      return "Not enough SOL or tokens in this wallet.";
    }
    return "The transaction failed. Please try again.";
  }
  if (code === SELO_ERROR__INVOICE_ALREADY_LOCKED && context) {
    try {
      const check = await checkInvoice(
        context.rpc,
        toInvoiceHash(context.invoice),
      );
      return describeSeloError(code, {
        lenderName: check.lender?.name,
        lockedAt: check.lockedAt,
      });
    } catch {
      // fall through to the generic message
    }
  }
  return describeSeloError(code);
}
