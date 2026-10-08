/**
 * Verified buyers: companies whose wallet the registry checked (KYB) and
 * bound to their tax ID. Only a verified buyer can attest an invoice, and a
 * lock only goes through if the attesting wallet is the company on the invoice.
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
  type Buyer,
  BUYER_DISCRIMINATOR,
  SELO_PROGRAM_ADDRESS,
  findBuyerRecordPda,
  getBuyerDecoder,
} from "./generated";
import { partyIdHash } from "./hash";

/** The `Buyer` account of the company with this tax ID (any formatting). */
export async function findBuyerRecordByTaxId(taxId: string): Promise<Address> {
  const [pda] = await findBuyerRecordPda({ taxIdHash: partyIdHash(taxId) });
  return pda;
}

// Buyer layout: discriminator (8) | authority (32) | ...
const AUTHORITY_OFFSET = 8n;

/** The verified identities a wallet signs for (usually one). */
export async function listBuyerRecords(
  rpc: Rpc<GetProgramAccountsApi>,
  authority: Address,
): Promise<{ address: Address; data: Buyer }[]> {
  const base58 = getBase58Decoder();
  const accounts = await rpc
    .getProgramAccounts(SELO_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: 0n,
            bytes: base58.decode(BUYER_DISCRIMINATOR) as Base58EncodedBytes,
            encoding: "base58",
          },
        },
        {
          memcmp: {
            offset: AUTHORITY_OFFSET,
            bytes: authority as unknown as Base58EncodedBytes,
            encoding: "base58",
          },
        },
      ],
    })
    .send();
  const decoder = getBuyerDecoder();
  const base64 = getBase64Encoder();
  return accounts.map(({ pubkey, account }) => ({
    address: pubkey,
    data: decoder.decode(base64.encode(account.data[0])),
  }));
}
