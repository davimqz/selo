import { expect } from "vitest";
import {
  type Address,
  type Instruction,
  type KeyPairSigner,
  appendTransactionMessageInstructions,
  assertAccountExists,
  createTransactionMessage,
  type GetAccountInfoApi,
  type Rpc,
  generateKeyPairSigner,
  getAddressEncoder,
  getBase64Decoder,
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
import {
  type Invoice,
  SELO_PROGRAM_ADDRESS,
  USDC_DECIMALS,
  decodeConfig,
  decodeLender,
  decodeSeal,
  findBuyerRecordByTaxId,
  findConfigPda,
  findLenderPda,
  findProgramDataAddress,
  findSealPda,
  getAttestInvoiceInstruction,
  getInitializeInstructionAsync,
  getLockInvoiceInstructionAsync,
  getReleaseInvoiceInstruction,
  getRegisterBuyerInstructionAsync,
  getRegisterLenderInstructionAsync,
  getSealInvoiceInstructionAsync,
  partyIdHash,
  sealArgs,
} from "@selo/sdk";

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
  /** The `Buyer` account for INVOICE's buyer tax ID (registered by setupRegistry). */
  buyerRecord: Address;
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
  AccountDiscriminatorMismatch: 3002,
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

export async function createMint(
  svm: LiteSVM,
  authority: KeyPairSigner,
  decimals: number = USDC_DECIMALS,
) {
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
        decimals,
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
  await setUpgradeAuthority(svm, admin.address);

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
    buyerRecord: await findBuyerRecordByTaxId(INVOICE.buyerTaxId),
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

/**
 * LiteSVM deploys the program with no upgrade authority; write one into the
 * ProgramData metadata (tag u32 | slot u64 | Option<Pubkey>, 45 bytes).
 */
export async function setUpgradeAuthority(svm: LiteSVM, authority: Address) {
  const programData = await findProgramDataAddress();
  const acc = svm.getAccount(programData);
  assertAccountExists(acc);
  const data = new Uint8Array(acc.data);
  data[12] = 1;
  data.set(getAddressEncoder().encode(authority), 13);
  svm.setAccount({ ...acc, data });
}

// ---------------------------------------------------------------- registry

export const LOCK_FEE = 2n * USDC;

export const INVOICE: Invoice = {
  buyerTaxId: "BUYER-001",
  supplierTaxId: "SUP-042",
  number: "INV-2026-0001",
  amount: 1_250_000n,
  currency: "USD",
  // NOW is 2027-01-15; due 90 days later.
  dueDate: "2027-04-15",
};

/** Initializes the registry with `admin` and a treasury ATA for the fee mint. */
export async function initRegistry(ctx: Ctx, lockFee: bigint = LOCK_FEE) {
  const treasury = await mintTo(ctx, ctx.admin.address, 0n);
  await sendOk(
    ctx.svm,
    [
      await getInitializeInstructionAsync({
        admin: ctx.admin,
        feeMint: ctx.feeMint,
        treasury,
        program: SELO_PROGRAM_ADDRESS,
        programData: await findProgramDataAddress(),
        lockFee,
      }),
    ],
    ctx.admin,
  );
  return { treasury };
}

export async function registerLender(
  ctx: Ctx,
  authority: Address,
  name: string,
) {
  await sendOk(
    ctx.svm,
    [
      await getRegisterLenderInstructionAsync({
        admin: ctx.admin,
        lenderAuthority: authority,
        name,
      }),
    ],
    ctx.admin,
  );
  return (await findLenderPda({ lenderAuthority: authority }))[0];
}

/** Verifies `authority` as the company with this tax ID (admin as KYB verifier). */
export async function registerBuyer(
  ctx: Ctx,
  authority: Address,
  taxId: string = INVOICE.buyerTaxId,
  name = "Buyer Co",
) {
  await sendOk(
    ctx.svm,
    [
      await getRegisterBuyerInstructionAsync({
        admin: ctx.admin,
        buyerAuthority: authority,
        taxIdHash: partyIdHash(taxId),
        name,
      }),
    ],
    ctx.admin,
  );
  return findBuyerRecordByTaxId(taxId);
}

export const LENDER_BALANCE = 100n * USDC;

/**
 * A registry with lenders A and B registered and holding USDC-dev, and the
 * buyer verified as the company on INVOICE.
 */
export async function setupRegistry() {
  const ctx = await setup();
  const { treasury } = await initRegistry(ctx);
  await registerBuyer(ctx, ctx.buyer.address);
  const lenderA = await registerLender(ctx, ctx.lenderA.address, "Lender A");
  const lenderB = await registerLender(ctx, ctx.lenderB.address, "Lender B");
  await mintTo(ctx, ctx.lenderA.address, LENDER_BALANCE);
  await mintTo(ctx, ctx.lenderB.address, LENDER_BALANCE);
  await mintTo(ctx, ctx.stranger.address, LENDER_BALANCE);
  return { ctx, treasury, lenderA, lenderB };
}

/** Sealed by the supplier and attested by the buyer: ready to lock. */
export async function setupAttested(invoice: Invoice = INVOICE) {
  const reg = await setupRegistry();
  const seal = await sealPdaOf(invoice);
  await sendOk(reg.ctx.svm, [await sealIx(reg.ctx, invoice)], reg.ctx.supplier);
  await sendOk(reg.ctx.svm, [attestIx(reg.ctx, seal)], reg.ctx.buyer);
  return { ...reg, seal };
}

export function attestIx(
  ctx: Ctx,
  seal: Address,
  buyer = ctx.buyer,
  buyerRecord = ctx.buyerRecord,
) {
  return getAttestInvoiceInstruction({ buyer, seal, buyerRecord });
}

export async function lockIx(
  ctx: Ctx,
  treasury: Address,
  seal: Address,
  lender: KeyPairSigner,
  overrides: Partial<{
    lender: Address;
    feeMint: Address;
    lenderToken: Address;
    treasury: Address;
    buyerRecord: Address;
  }> = {},
) {
  const feeMint = overrides.feeMint ?? ctx.feeMint;
  return getLockInvoiceInstructionAsync({
    lenderAuthority: lender,
    lender: overrides.lender,
    seal,
    buyerRecord: overrides.buyerRecord ?? ctx.buyerRecord,
    feeMint,
    lenderToken:
      overrides.lenderToken ?? (await ctx.ata(lender.address, feeMint)),
    treasury: overrides.treasury ?? treasury,
  });
}

export function releaseIx(seal: Address, lender: KeyPairSigner) {
  return getReleaseInvoiceInstruction({ lenderAuthority: lender, seal });
}

/** A read-only RPC over LiteSVM, enough for checkInvoice() and explainError(). */
export function svmRpc(svm: LiteSVM): Rpc<GetAccountInfoApi> {
  const b64 = getBase64Decoder();
  return {
    getAccountInfo: (address: Address) => ({
      send: async () => {
        const acc = svm.getAccount(address);
        return {
          context: { slot: 0n },
          value: acc.exists
            ? {
                data: [b64.decode(acc.data), "base64"],
                executable: acc.executable,
                lamports: acc.lamports,
                owner: acc.programAddress,
                space: BigInt(acc.data.length),
                rentEpoch: 0n,
              }
            : null,
        };
      },
    }),
  } as unknown as Rpc<GetAccountInfoApi>;
}

export async function sealIx(
  ctx: Ctx,
  invoice: Invoice = INVOICE,
  overrides: Partial<{
    supplier: KeyPairSigner;
    buyer: Address;
    faceAmount: bigint;
    currency: Uint8Array;
    dueTs: bigint;
  }> = {},
) {
  const args = sealArgs(invoice);
  return getSealInvoiceInstructionAsync({
    supplier: overrides.supplier ?? ctx.supplier,
    invoiceHash: args.invoiceHash,
    buyer: overrides.buyer ?? ctx.buyer.address,
    faceAmount: overrides.faceAmount ?? args.faceAmount,
    currency: overrides.currency ?? args.currency,
    dueTs: overrides.dueTs ?? args.dueTs,
  });
}

export async function sealPdaOf(invoice: Invoice = INVOICE) {
  return (await findSealPda({ invoiceHash: sealArgs(invoice).invoiceHash }))[0];
}

export async function fetchConfig(svm: LiteSVM) {
  const acc = decodeConfig(svm.getAccount((await findConfigPda())[0]));
  assertAccountExists(acc);
  return acc.data;
}

export function fetchLender(svm: LiteSVM, lender: Address) {
  const acc = decodeLender(svm.getAccount(lender));
  assertAccountExists(acc);
  return acc.data;
}

export function fetchSeal(svm: LiteSVM, seal: Address) {
  const acc = decodeSeal(svm.getAccount(seal));
  assertAccountExists(acc);
  return acc.data;
}
