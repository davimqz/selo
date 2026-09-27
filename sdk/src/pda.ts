// PDAs whose seeds Codama cannot express from the IDL (seeds read from
// account data or instruction args). Vault and document PDAs are generated.
import {
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
} from "@solana/kit";
import { SELO_PROGRAM_ADDRESS } from "./generated";

const addr = getAddressEncoder();
const utf8 = (s: string) => new TextEncoder().encode(s);

export async function findDealPda(
  seller: Address,
  dealId: bigint,
  programAddress: Address = SELO_PROGRAM_ADDRESS,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [utf8("deal"), addr.encode(seller), getU64Encoder().encode(dealId)],
  });
  return pda;
}

export async function findMilestonePda(
  deal: Address,
  milestone: number,
  programAddress: Address = SELO_PROGRAM_ADDRESS,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [utf8("milestone"), addr.encode(deal), Uint8Array.of(milestone)],
  });
  return pda;
}
