import {
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
} from "@solana/kit";
import { SELO_PROGRAM_ADDRESS } from "./constants";

const addr = getAddressEncoder();
const u64 = getU64Encoder();
const utf8 = (s: string) => new TextEncoder().encode(s);

async function pda(
  seeds: Uint8Array[],
  programAddress: Address,
): Promise<Address> {
  const [found] = await getProgramDerivedAddress({ programAddress, seeds });
  return found;
}

export function findDealPda(
  seller: Address,
  dealId: bigint,
  programAddress: Address = SELO_PROGRAM_ADDRESS,
) {
  return pda(
    [
      utf8("deal"),
      new Uint8Array(addr.encode(seller)),
      new Uint8Array(u64.encode(dealId)),
    ],
    programAddress,
  );
}

export function findVaultPda(
  deal: Address,
  programAddress: Address = SELO_PROGRAM_ADDRESS,
) {
  return pda(
    [utf8("vault"), new Uint8Array(addr.encode(deal))],
    programAddress,
  );
}

export function findDocumentPda(
  docHash: Uint8Array,
  programAddress: Address = SELO_PROGRAM_ADDRESS,
) {
  return pda([utf8("doc"), docHash], programAddress);
}

export function findMilestonePda(
  deal: Address,
  milestone: number,
  programAddress: Address = SELO_PROGRAM_ADDRESS,
) {
  return pda(
    [utf8("milestone"), new Uint8Array(addr.encode(deal)), Uint8Array.of(milestone)],
    programAddress,
  );
}
