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
import { address } from "@solana/kit";
import { loadKeypair, statePath } from "./lib";
import { UNIT, ensureFeeMint, fundPayerOnLocalnet, mintTo } from "./mint";

const amount = BigInt(process.env.AMOUNT || "1000") * UNIT;

async function main() {
  const payer = await loadKeypair();
  const recipients = process.argv.slice(2).map((a) => address(a));

  await fundPayerOnLocalnet(payer);
  const feeMint = await ensureFeeMint(payer);

  for (const owner of recipients) {
    await mintTo(payer, feeMint, owner, amount);
    console.log(`Minted ${amount / UNIT} USDC-dev to ${owner}`);
  }
  console.log(`State: ${statePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
