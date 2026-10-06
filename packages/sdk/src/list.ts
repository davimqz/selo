/**
 * Lists Seal accounts by supplier or buyer (getProgramAccounts + memcmp), for
 * the supplier's "my seals" and the buyer's "to attest" screens.
 */
import {
  type Address,
  type Base58EncodedBytes,
  type GetProgramAccountsApi,
  type Rpc,
  getBase58Decoder,
  getBase64Encoder,
} from "@solana/kit";
import {
  type Seal,
  SEAL_DISCRIMINATOR,
  SELO_PROGRAM_ADDRESS,
  getSealDecoder,
  getSealSize,
} from "./generated";

// Seal layout: discriminator (8) | invoice_hash (32) | supplier (32) | buyer (32)
const SUPPLIER_OFFSET = 8n + 32n;
const BUYER_OFFSET = SUPPLIER_OFFSET + 32n;

export interface SealEntry {
  address: Address;
  data: Seal;
}

export async function listSeals(
  rpc: Rpc<GetProgramAccountsApi>,
  by: { supplier: Address } | { buyer: Address },
): Promise<SealEntry[]> {
  const [offset, party] =
    "supplier" in by
      ? [SUPPLIER_OFFSET, by.supplier]
      : [BUYER_OFFSET, by.buyer];
  const base58 = getBase58Decoder();
  const accounts = await rpc
    .getProgramAccounts(SELO_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [
        { dataSize: BigInt(getSealSize()) },
        {
          memcmp: {
            offset: 0n,
            bytes: base58.decode(SEAL_DISCRIMINATOR) as Base58EncodedBytes,
            encoding: "base58",
          },
        },
        {
          memcmp: {
            offset,
            bytes: party as unknown as Base58EncodedBytes,
            encoding: "base58",
          },
        },
      ],
    })
    .send();
  const decoder = getSealDecoder();
  const base64 = getBase64Encoder();
  return accounts
    .map(({ pubkey, account }) => ({
      address: pubkey,
      data: decoder.decode(base64.encode(account.data[0])),
    }))
    .sort((a, b) => Number(b.data.createdAt - a.data.createdAt));
}
