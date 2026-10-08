/**
 * checkInvoice(): the call a lender puts in its credit flow before financing.
 */
import type {
  Address,
  GetAccountInfoApi,
  ReadonlyUint8Array,
  Rpc,
} from "@solana/kit";
import {
  SealStatus,
  fetchMaybeBuyer,
  fetchMaybeLender,
  fetchMaybeSeal,
  findLenderPda,
  findSealPda,
} from "./generated";
import { findBuyerRecordByTaxId } from "./buyers";
import { type Invoice, fromHex, invoiceHash } from "./hash";

const DEFAULT_ADDRESS = "11111111111111111111111111111111";

export type InvoiceStatus =
  "free" | "sealed" | "locked" | "released" | "cancelled";

/**
 * Whether the wallet named as buyer is the KYB-verified company on the
 * invoice. Needs the invoice data: from a bare hash it is `"unknown"`.
 *
 * - `verified`: that company's verified wallet is the invoice's buyer.
 * - `mismatch`: the company is verified, but with another wallet. Do not finance.
 * - `unverified`: the company on the invoice is not verified in the registry.
 */
export type BuyerVerification =
  "verified" | "mismatch" | "unverified" | "unknown";

export interface InvoiceCheck {
  status: InvoiceStatus;
  /** The invoice's Seal account (derived even when it does not exist yet). */
  seal: Address;
  /** Whether the buyer attested the invoice is real and due. */
  attested: boolean;
  /** The buyer's wallet and whether it is the verified company on the invoice. */
  buyer?: { wallet: Address; verification: BuyerVerification; name?: string };
  /** The lender that locked it (locked or released). */
  lender?: { address: Address; name: string };
  lockedAt?: Date;
  /** Clear-text terms stored on-chain, when sealed. */
  terms?: { faceAmount: bigint; currency: string; dueDate: Date };
}

const STATUS: Record<SealStatus, InvoiceStatus> = {
  [SealStatus.Sealed]: "sealed",
  [SealStatus.Locked]: "locked",
  [SealStatus.Released]: "released",
  [SealStatus.Cancelled]: "cancelled",
};

/** Accepts the invoice fields, its 32-byte hash, or the hash as hex. */
export function toInvoiceHash(
  invoice: Invoice | ReadonlyUint8Array | string,
): ReadonlyUint8Array {
  if (typeof invoice === "string") return fromHex(invoice);
  if (invoice instanceof Uint8Array) return invoice;
  return invoiceHash(invoice as Invoice);
}

async function verifyBuyer(
  rpc: Rpc<GetAccountInfoApi>,
  invoice: Invoice | ReadonlyUint8Array | string,
  wallet: Address,
): Promise<NonNullable<InvoiceCheck["buyer"]>> {
  if (typeof invoice === "string" || invoice instanceof Uint8Array) {
    return { wallet, verification: "unknown" };
  }
  const record = await fetchMaybeBuyer(
    rpc,
    await findBuyerRecordByTaxId((invoice as Invoice).buyerTaxId),
  );
  if (!record.exists || !record.data.active) {
    return { wallet, verification: "unverified" };
  }
  return {
    wallet,
    name: record.data.name,
    verification: record.data.authority === wallet ? "verified" : "mismatch",
  };
}

export async function checkInvoice(
  rpc: Rpc<GetAccountInfoApi>,
  invoice: Invoice | ReadonlyUint8Array | string,
): Promise<InvoiceCheck> {
  const [seal] = await findSealPda({ invoiceHash: toInvoiceHash(invoice) });
  const account = await fetchMaybeSeal(rpc, seal);
  if (!account.exists) return { status: "free", seal, attested: false };

  const data = account.data;
  const result: InvoiceCheck = {
    status: STATUS[data.status],
    seal,
    attested: data.buyerAttested,
    buyer: await verifyBuyer(rpc, invoice, data.buyer),
    terms: {
      faceAmount: data.faceAmount,
      currency: new TextDecoder().decode(new Uint8Array(data.currency)),
      dueDate: new Date(Number(data.dueTs) * 1000),
    },
  };
  if (data.lender !== DEFAULT_ADDRESS) {
    const [lenderPda] = await findLenderPda({ lenderAuthority: data.lender });
    const lender = await fetchMaybeLender(rpc, lenderPda);
    result.lender = {
      address: data.lender,
      name: lender.exists ? lender.data.name : data.lender,
    };
    result.lockedAt = new Date(Number(data.lockedAt) * 1000);
  }
  return result;
}
