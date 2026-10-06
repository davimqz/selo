/**
 * Creates the `USDC-dev` test mint (6 decimals) used for Selo's lock fee, then
 * mints test tokens to the given wallets. Idempotent: the mint is saved in
 * scripts/.<cluster>.json and reused on later runs. The payer wallet is the
 * mint authority ("faucet"). Test tokens only — never run on mainnet.
 *
 * Usage:
 *   pnpm create-mint                                  # mint + 1,000,000 to the payer
 *   pnpm create-mint <wallet> [<wallet>...]           # + 1,000 to each wallet
 *   AMOUNT=500 pnpm create-mint <wallet>              # custom amount (whole tokens)
 *
 * Env: RPC_URL (localnet by default), WALLET_PATH (payer keypair).
 */
import {
  type Address,
  address,
  generateKeyPairSigner,
  lamports,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
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
  loadKeypair,
  readState,
  rpc,
  send,
  statePath,
  writeState,
} from "./lib";

const UNIT = 10n ** BigInt(USDC_DECIMALS);
const PAYER_SUPPLY = 1_000_000n * UNIT;
const amount = BigInt(process.env.AMOUNT || "1000") * UNIT;

async function main() {
  const payer = await loadKeypair();
  const recipients = process.argv.slice(2).map((a) => address(a));

  if (cluster === "localnet") {
    const balance = await rpc.getBalance(payer.address).send();
    if (balance.value < lamports(1_000_000_000n)) {
      await rpc.requestAirdrop(payer.address, lamports(2_000_000_000n)).send();
      // The airdrop returns before it lands; wait for the balance.
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const { value } = await rpc.getBalance(payer.address).send();
        if (value >= lamports(1_000_000_000n)) break;
      }
    }
  }

  const state = readState();
  let feeMint = state.feeMint ? address(state.feeMint) : undefined;
  if (feeMint && !(await accountExists(feeMint))) feeMint = undefined;

  if (!feeMint) {
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
    feeMint = mint.address;
    await mintTo(payer, feeMint, payer.address, PAYER_SUPPLY);
    writeState({ ...state, feeMint, mintAuthority: payer.address });
    console.log(`Created USDC-dev mint ${feeMint} (${cluster})`);
  } else {
    const mint = await fetchMint(rpc, feeMint);
    if (mint.data.decimals !== USDC_DECIMALS) {
      throw new Error(`${feeMint} does not have ${USDC_DECIMALS} decimals`);
    }
    console.log(`Reusing USDC-dev mint ${feeMint} (${cluster})`);
  }

  for (const owner of recipients) {
    await mintTo(payer, feeMint, owner, amount);
    console.log(`Minted ${amount / UNIT} USDC-dev to ${owner}`);
  }
  console.log(`State: ${statePath}`);
}

async function mintTo(
  payer: Awaited<ReturnType<typeof loadKeypair>>,
  mint: Address,
  owner: Address,
  value: bigint,
) {
  const [token] = await findAssociatedTokenPda({
    mint,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await send(payer, [
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer,
      mint,
      owner,
    }),
    getMintToInstruction({ mint, token, mintAuthority: payer, amount: value }),
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
