/**
 * Creates a mock USDC mint (6 decimals) on a local Surfpool network or devnet
 * and mints a starting balance to the payer. Writes the result to
 * scripts/.localnet.json so tests, seed scripts and the app can pick it up.
 *
 * Usage:
 *   pnpm localnet            # Surfpool, in another terminal
 *   pnpm usdc:mock           # RPC_URL defaults to http://127.0.0.1:8899
 */
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
} from "@solana-program/token";
import { readFileSync } from "node:fs";
import { USDC_DECIMALS } from "@selo/sdk";

const INITIAL_SUPPLY = 1_000_000n * 10n ** BigInt(USDC_DECIMALS);

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8899";
const wsUrl = rpcUrl.replace(/^http/, "ws").replace(/:8899\b/, ":8900");
const walletPath =
  process.env.WALLET_PATH || join(homedir(), ".config/solana/id.json");
const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".localnet.json",
);

const rpc = createSolanaRpc(rpcUrl);
const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

async function send(payer: KeyPairSigner, instructions: Instruction[]) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(signed);
  await sendAndConfirm(signed, { commitment: "confirmed" });
  return getSignatureFromTransaction(signed);
}

async function main() {
  const payer = await createKeyPairSignerFromBytes(
    Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf8")) as number[]),
  );

  const balance = await rpc.getBalance(payer.address).send();
  if (balance.value < lamports(1_000_000_000n)) {
    await rpc.requestAirdrop(payer.address, lamports(2_000_000_000n)).send();
  }

  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = await rpc.getMinimumBalanceForRentExemption(space).send();
  const [ata] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

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
      mintAuthority: payer.address, // the local wallet acts as the "faucet"
    }),
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer,
      mint: mint.address,
      owner: payer.address,
    }),
    getMintToInstruction({
      mint: mint.address,
      token: ata,
      mintAuthority: payer,
      amount: INITIAL_SUPPLY,
    }),
  ]);

  const result = {
    rpcUrl,
    usdcMint: mint.address,
    mintAuthority: payer.address,
    decimals: USDC_DECIMALS,
  };
  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`Mock USDC mint: ${mint.address}`);
  console.log(`Minted ${INITIAL_SUPPLY / 10n ** 6n} USDC to ${ata}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
