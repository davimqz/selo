/**
 * Shared plumbing for the scripts: RPC from env, payer keypair, send + confirm,
 * and a per-cluster state file (scripts/.<cluster>.json, gitignored).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Instruction,
  type KeyPairSigner,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";

export const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8899";
const wsUrl = rpcUrl.replace(/^http/, "ws").replace(/:8899\b/, ":8900");

export const cluster = /devnet/.test(rpcUrl)
  ? "devnet"
  : /127\.0\.0\.1|localhost/.test(rpcUrl)
    ? "localnet"
    : "custom";

if (/mainnet/.test(rpcUrl)) {
  throw new Error("Selo scripts never run against mainnet.");
}

export const rpc = createSolanaRpc(rpcUrl);
const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

export async function loadKeypair(path?: string): Promise<KeyPairSigner> {
  const file =
    path ||
    process.env.WALLET_PATH ||
    join(homedir(), ".config/solana/id.json");
  return createKeyPairSignerFromBytes(
    Uint8Array.from(JSON.parse(readFileSync(file, "utf8")) as number[]),
  );
}

export async function send(
  payer: KeyPairSigner,
  instructions: Instruction[],
): Promise<string> {
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

export async function accountExists(address: string): Promise<boolean> {
  const { value } = await rpc
    .getAccountInfo(address as never, { encoding: "base64" })
    .send();
  return value !== null;
}

export interface ClusterState {
  rpcUrl: string;
  feeMint?: string;
  mintAuthority?: string;
  [key: string]: unknown;
}

export const statePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  `.${cluster}.json`,
);

export function readState(): ClusterState {
  return existsSync(statePath)
    ? (JSON.parse(readFileSync(statePath, "utf8")) as ClusterState)
    : { rpcUrl };
}

export function writeState(state: ClusterState) {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}
