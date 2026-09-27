/**
 * Creates a mock USDC mint (6 decimals) on a local validator or devnet and
 * mints a starting balance to the payer. Writes the result to
 * scripts/.localnet.json so tests, seed scripts and the app can pick it up.
 *
 * Usage:
 *   pnpm localnet            # in another terminal
 *   pnpm usdc:mock           # RPC_URL defaults to http://127.0.0.1:8899
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

const USDC_DECIMALS = 6;
const INITIAL_SUPPLY = 1_000_000n * 10n ** BigInt(USDC_DECIMALS);

const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const walletPath =
  process.env.WALLET_PATH ?? join(homedir(), ".config/solana/id.json");
const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".localnet.json",
);

function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function ensureFunded(connection: Connection, owner: PublicKey) {
  const balance = await connection.getBalance(owner);
  if (balance >= LAMPORTS_PER_SOL) return;
  const sig = await connection.requestAirdrop(owner, 2 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

async function main() {
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = loadKeypair(walletPath);
  await ensureFunded(connection, payer.publicKey);

  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority: the local wallet acts as the "faucet"
    null,
    USDC_DECIMALS,
  );
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
  );
  await mintTo(connection, payer, mint, ata.address, payer, INITIAL_SUPPLY);

  const result = {
    rpcUrl,
    usdcMint: mint.toBase58(),
    mintAuthority: payer.publicKey.toBase58(),
    decimals: USDC_DECIMALS,
  };
  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`Mock USDC mint: ${result.usdcMint}`);
  console.log(`Minted ${INITIAL_SUPPLY / 10n ** 6n} USDC to ${ata.address}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
