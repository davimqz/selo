/**
 * The `USDC-dev` test mint (6 decimals) used for Selo's lock fee. Shared by
 * create-mint and seed-demo. Test tokens only — never run on mainnet.
 */
import {
  type Address,
  type KeyPairSigner,
  address,
  generateKeyPairSigner,
  lamports,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMaybeToken,
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
} from "@solana-program/token";
import { USDC_DECIMALS } from "@selo/sdk";
import {
  accountExists,
  cluster,
  readState,
  rpc,
  send,
  writeState,
} from "./lib";

export const UNIT = 10n ** BigInt(USDC_DECIMALS);
const PAYER_SUPPLY = 1_000_000n * UNIT;

/** Localnet only: airdrops SOL to the payer when it runs low. */
export async function fundPayerOnLocalnet(payer: KeyPairSigner) {
  if (cluster !== "localnet") return;
  const balance = await rpc.getBalance(payer.address).send();
  if (balance.value >= lamports(1_000_000_000n)) return;
  await rpc.requestAirdrop(payer.address, lamports(2_000_000_000n)).send();
  // The airdrop returns before it lands; wait for the balance.
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const { value } = await rpc.getBalance(payer.address).send();
    if (value >= lamports(1_000_000_000n)) return;
  }
}

/**
 * Returns the cluster's USDC-dev mint, creating it (payer as mint authority,
 * 1,000,000 tokens to the payer) on first run. Saved in scripts/.<cluster>.json.
 */
export async function ensureFeeMint(payer: KeyPairSigner): Promise<Address> {
  const state = readState();
  const saved = state.feeMint ? address(state.feeMint) : undefined;
  if (saved && (await accountExists(saved))) {
    const mint = await fetchMint(rpc, saved);
    if (mint.data.decimals !== USDC_DECIMALS) {
      throw new Error(`${saved} does not have ${USDC_DECIMALS} decimals`);
    }
    console.log(`Reusing USDC-dev mint ${saved} (${cluster})`);
    return saved;
  }

  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = await rpc.getMinimumBalanceForRentExemption(space).send();
  await send(payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({
      mint: mint.address,
      decimals: USDC_DECIMALS,
      mintAuthority: payer.address,
    }),
  ]);
  await mintTo(payer, mint.address, payer.address, PAYER_SUPPLY);
  writeState({
    ...readState(),
    feeMint: mint.address,
    mintAuthority: payer.address,
  });
  console.log(`Created USDC-dev mint ${mint.address} (${cluster})`);
  return mint.address;
}

export async function ataOf(owner: Address, mint: Address): Promise<Address> {
  const [token] = await findAssociatedTokenPda({
    mint,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return token;
}

/** Mints `value` (minor units) to the owner's ATA, creating it if needed. */
export async function mintTo(
  payer: KeyPairSigner,
  mint: Address,
  owner: Address,
  value: bigint,
) {
  await send(payer, [
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer,
      mint,
      owner,
    }),
    getMintToInstruction({
      mint,
      token: await ataOf(owner, mint),
      mintAuthority: payer,
      amount: value,
    }),
  ]);
}

/** Tops the owner's ATA up to at least `target` (minor units). */
export async function topUpTokens(
  payer: KeyPairSigner,
  mint: Address,
  owner: Address,
  target: bigint,
): Promise<bigint> {
  const token = await fetchMaybeToken(rpc, await ataOf(owner, mint));
  const balance = token.exists ? token.data.amount : 0n;
  if (balance >= target) return 0n;
  await mintTo(payer, mint, owner, target - balance);
  return target - balance;
}
