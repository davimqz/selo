import { createSolanaRpc } from "@solana/kit";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export const IS_LOCALNET = /127\.0\.0\.1|localhost/.test(RPC_URL);

if (/mainnet/.test(RPC_URL)) {
  throw new Error("Selo's demo app never talks to mainnet.");
}

/** Wallet Standard chain the wallet signs for. */
export const CHAIN = IS_LOCALNET ? "solana:localnet" : "solana:devnet";

export const rpc = createSolanaRpc(RPC_URL);

export function explorerTx(signature: string): string {
  const cluster = IS_LOCALNET
    ? `custom&customUrl=${encodeURIComponent(RPC_URL)}`
    : "devnet";
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function explorerAddress(address: string): string {
  const cluster = IS_LOCALNET
    ? `custom&customUrl=${encodeURIComponent(RPC_URL)}`
    : "devnet";
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
}
