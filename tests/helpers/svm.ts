import { join } from "node:path";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from "litesvm";

export const SELO_PROGRAM_ID = new PublicKey(
  "4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio",
);
export const SELO_SO_PATH = join(__dirname, "../../target/deploy/selo.so");
export const USDC_DECIMALS = 6;

/** 1 USDC in base units. */
export const USDC = 10n ** BigInt(USDC_DECIMALS);

/** Fresh in-process SVM with the Selo program and SPL programs loaded. */
export function startSvm(): LiteSVM {
  const svm = new LiteSVM();
  svm.addProgramFromFile(SELO_PROGRAM_ID, SELO_SO_PATH);
  return svm;
}

export function fundedKeypair(svm: LiteSVM, sol = 10): Keypair {
  const kp = Keypair.generate();
  svm.airdrop(kp.publicKey, BigInt(sol * LAMPORTS_PER_SOL));
  return kp;
}

export function send(
  svm: LiteSVM,
  ixs: TransactionInstruction[],
  signers: Keypair[],
): TransactionMetadata {
  const res = trySend(svm, ixs, signers);
  if (res instanceof FailedTransactionMetadata) {
    throw new Error(
      `tx failed: ${res.err().toString()}\n${res.meta().logs().join("\n")}`,
    );
  }
  return res;
}

export function trySend(
  svm: LiteSVM,
  ixs: TransactionInstruction[],
  signers: Keypair[],
): TransactionMetadata | FailedTransactionMetadata {
  const tx = new Transaction();
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = signers[0].publicKey;
  tx.add(...ixs);
  tx.sign(...signers);
  const res = svm.sendTransaction(tx);
  // Avoid "AlreadyProcessed" when the same tx bytes are sent twice in a test.
  svm.expireBlockhash();
  return res;
}

/** Creates a 6-decimal mock USDC mint whose authority is `authority`. */
export function createMockUsdc(svm: LiteSVM, authority: Keypair): PublicKey {
  const mint = Keypair.generate();
  const lamports = Number(
    svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE)),
  );
  send(
    svm,
    [
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        USDC_DECIMALS,
        authority.publicKey,
        null,
      ),
    ],
    [authority, mint],
  );
  return mint.publicKey;
}

/** Mints `amount` base units of mock USDC to `owner`'s ATA, creating it if needed. */
export function mintUsdc(
  svm: LiteSVM,
  mint: PublicKey,
  authority: Keypair,
  owner: PublicKey,
  amount: bigint,
): PublicKey {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  send(
    svm,
    [
      createAssociatedTokenAccountIdempotentInstruction(
        authority.publicKey,
        ata,
        owner,
        mint,
      ),
      createMintToInstruction(mint, ata, authority.publicKey, amount),
    ],
    [authority],
  );
  return ata;
}

function accountInfo(svm: LiteSVM, address: PublicKey) {
  const acc = svm.getAccount(address);
  if (!acc) throw new Error(`account not found: ${address.toBase58()}`);
  return { ...acc, data: Buffer.from(acc.data) };
}

export function tokenBalance(svm: LiteSVM, tokenAccount: PublicKey): bigint {
  return unpackAccount(tokenAccount, accountInfo(svm, tokenAccount)).amount;
}

export function mintInfo(svm: LiteSVM, mint: PublicKey) {
  return unpackMint(mint, accountInfo(svm, mint));
}
