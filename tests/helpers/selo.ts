import { expect } from "vitest";
import {
  type Address,
  type Instruction,
  type KeyPairSigner,
  appendTransactionMessageInstructions,
  assertAccountExists,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64Encoder,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
  getTokenDecoder,
} from "@solana-program/token";
import {
  FailedTransactionMetadata,
  LiteSVM,
  type TransactionMetadata,
} from "litesvm";
import { SELO_PROGRAM_ADDRESS, USDC_DECIMALS } from "@selo/sdk";

export const USDC = 10n ** BigInt(USDC_DECIMALS);
export const NOW = 1_800_000_000n;
export const DAY = 86_400n;

type TxResult = TransactionMetadata | FailedTransactionMetadata;

export interface Ctx {
  svm: LiteSVM;
  /** Fee payer and mint authority for test tokens. */
  faucet: KeyPairSigner;
  admin: KeyPairSigner;
  supplier: KeyPairSigner;
  buyer: KeyPairSigner;
  lenderA: KeyPairSigner;
  lenderB: KeyPairSigner;
  stranger: KeyPairSigner;
  /** `USDC-dev` (6 decimals), the lock-fee mint. */
  feeMint: Address;
  /** A second 6-decimal mint, for wrong-mint failure tests. */
  otherMint: Address;
  ata: (owner: Address, mint?: Address) => Promise<Address>;
}

// ---------------------------------------------------------------- transport

export async function send(
  svm: LiteSVM,
  instructions: Instruction[],
  payer: KeyPairSigner,
): Promise<TxResult> {
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: svm.latestBlockhash(), lastValidBlockHeight: 1_000_000n },
        m,
      ),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const tx = await signTransactionMessageWithSigners(message);
  const res = svm.sendTransaction(tx);
  // Identical transactions would otherwise be rejected as already processed.
  svm.expireBlockhash();
  return res;
}

export async function sendOk(
  svm: LiteSVM,
  instructions: Instruction[],
  payer: KeyPairSigner,
): Promise<TransactionMetadata> {
  const res = await send(svm, instructions, payer);
  if (res instanceof FailedTransactionMetadata) {
    throw new Error(
      `tx failed: ${res.toString()}\n${res.meta().logs().join("\n")}`,
    );
  }
  return res;
}

export function logsOf(res: TxResult): string[] {
  return res instanceof FailedTransactionMetadata
    ? res.meta().logs()
    : res.logs();
}

/** Asserts the tx failed with a given Anchor/Selo error number (6000+ custom, 2000+ constraints). */
export function expectError(res: TxResult, code: number) {
  expectFailure(res);
  const logs = logsOf(res).join("\n");
  expect(logs, `expected error ${code}`).toContain(`Error Number: ${code}.`);
}

export function expectFailure(res: TxResult) {
  expect(res, "transaction should fail").toBeInstanceOf(
    FailedTransactionMetadata,
  );
}

/** Anchor framework error numbers used in tests. */
export const AnchorErr = {
  ConstraintHasOne: 2001,
  ConstraintSeeds: 2006,
  ConstraintAddress: 2012,
  ConstraintTokenMint: 2014,
  ConstraintTokenOwner: 2015,
  AccountNotInitialized: 3012,
} as const;

/** Decodes `Program data:` event logs whose discriminator matches `parse`. */
export function eventsOf<T>(res: TxResult, parse: (d: Uint8Array) => T): T[] {
  const b64 = getBase64Encoder();
  const out: T[] = [];
  for (const line of logsOf(res)) {
    const m = line.match(/^Program data: (.+)$/);
    if (!m) continue;
    try {
      out.push(parse(new Uint8Array(b64.encode(m[1]))));
    } catch {
      // other event type
    }
  }
  return out;
}

// ---------------------------------------------------------------- clock

export function setTime(svm: LiteSVM, unixTimestamp: bigint) {
  const clock = svm.getClock();
  clock.unixTimestamp = unixTimestamp;
  svm.setClock(clock);
}

// ---------------------------------------------------------------- state

export function tokenBalance(svm: LiteSVM, account: Address): bigint {
  const acc = svm.getAccount(account);
  assertAccountExists(acc);
  return getTokenDecoder().decode(acc.data).amount;
}

export function accountExists(svm: LiteSVM, account: Address): boolean {
  return svm.getAccount(account).exists;
}

// ---------------------------------------------------------------- setup

async function funded(svm: LiteSVM): Promise<KeyPairSigner> {
  const kp = await generateKeyPairSigner();
  svm.airdrop(kp.address, lamports(10_000_000_000n));
  return kp;
}

async function createMint(svm: LiteSVM, authority: KeyPairSigner) {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  await sendOk(
    svm,
    [
      getCreateAccountInstruction({
        payer: authority,
        newAccount: mint,
        lamports: lamports(svm.minimumBalanceForRentExemption(space)),
        space,
        programAddress: TOKEN_PROGRAM_ADDRESS,
      }),
      getInitializeMint2Instruction({
        mint: mint.address,
        decimals: USDC_DECIMALS,
        mintAuthority: authority.address,
      }),
    ],
    authority,
  );
  return mint.address;
}

export async function mintTo(
  ctx: Ctx,
  owner: Address,
  amount: bigint,
  mint: Address = ctx.feeMint,
): Promise<Address> {
  const token = await ctx.ata(owner, mint);
  await sendOk(
    ctx.svm,
    [
      await getCreateAssociatedTokenIdempotentInstructionAsync({
        payer: ctx.faucet,
        mint,
        owner,
      }),
      getMintToInstruction({
        mint,
        token,
        mintAuthority: ctx.faucet,
        amount,
      }),
    ],
    ctx.faucet,
  );
  return token;
}

export async function setup(): Promise<Ctx> {
  const svm = new LiteSVM();
  svm.addProgramFromFile(SELO_PROGRAM_ADDRESS, "target/deploy/selo.so");
  setTime(svm, NOW);

  const [faucet, admin, supplier, buyer, lenderA, lenderB, stranger] =
    await Promise.all(Array.from({ length: 7 }, () => funded(svm)));
  const feeMint = await createMint(svm, faucet);
  const otherMint = await createMint(svm, faucet);

  return {
    svm,
    faucet,
    admin,
    supplier,
    buyer,
    lenderA,
    lenderB,
    stranger,
    feeMint,
    otherMint,
    ata: async (owner, m = feeMint) =>
      (
        await findAssociatedTokenPda({
          owner,
          mint: m,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        })
      )[0],
  };
}
