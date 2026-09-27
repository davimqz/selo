import { address } from "@solana/kit";

export const SELO_PROGRAM_ADDRESS = address(
  "4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio",
);

/** Milestone bit flags (mirror `programs/selo/src/constants.rs`). */
export const Milestone = {
  INSPECTED: 1 << 0,
  SHIPPED: 1 << 1,
  EUDR_COMPLIANT: 1 << 2,
  DELIVERED: 1 << 3,
} as const;
export type MilestoneBit = (typeof Milestone)[keyof typeof Milestone];

/** Letter-of-credit default: payment against documents, DELIVERED optional. */
export const DEFAULT_REQUIRED_MILESTONES =
  Milestone.INSPECTED | Milestone.SHIPPED | Milestone.EUDR_COMPLIANT;

export enum DocType {
  BillOfLading = 0,
  CommercialInvoice = 1,
  Cpr = 2,
}

export const BPS_DENOMINATOR = 10_000;
export const MAX_ATTESTERS = 4;
export const USDC_DECIMALS = 6;
