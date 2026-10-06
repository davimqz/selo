// Addresses Codama cannot derive from the IDL.
import {
  type Address,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { SELO_PROGRAM_ADDRESS } from "./generated";

export const BPF_LOADER_UPGRADEABLE_ADDRESS = address(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

/** The program's ProgramData account, which records its upgrade authority. */
export async function findProgramDataAddress(
  programAddress: Address = SELO_PROGRAM_ADDRESS,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: BPF_LOADER_UPGRADEABLE_ADDRESS,
    seeds: [getAddressEncoder().encode(programAddress)],
  });
  return pda;
}
