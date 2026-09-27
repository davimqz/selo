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
  getInitializeAccount3Instruction,
  getInitializeMint2Instruction,
  getMintSize,
  getTokenSize,
  getMintToInstruction,
  getTokenDecoder,
} from "@solana-program/token";
import {
  FailedTransactionMetadata,
  LiteSVM,
  type TransactionMetadata,
} from "litesvm";
import {
  type AttesterEntryArgs,
  DEFAULT_REQUIRED_MILESTONES,
  DocType,
  Milestone,
  SELO_PROGRAM_ADDRESS,
  USDC_DECIMALS,
  decodeDeal,
  docHash,
  findDealPda,
  findDocRecordPda,
  findMilestonePda,
  findVaultPda,
  getAdvanceInstruction,
  getAttestMilestoneInstruction,
  getCancelInstruction,
  getCreateDealInstruction,
  getFundEscrowInstructionAsync,
  getRefundInstructionAsync,
  getRegisterDocumentInstructionAsync,
  getSettleInstructionAsync,
} from "@selo/sdk";

export const USDC = 10n ** BigInt(USDC_DECIMALS);
export const NOW = 1_800_000_000n;
export const DAY = 86_400n;
export const AMOUNT = 100_000n * USDC;
export const MAX_ADVANCE_BPS = 8_000;
export const ADVANCE_FEE_BPS = 200;
export const EVIDENCE = new Uint8Array(32).fill(7);
export const BL = { issuer: "MAEU", number: "MAEU-123 456" };

type TxResult = TransactionMetadata | FailedTransactionMetadata;

export interface Ctx {
  svm: LiteSVM;
  faucet: KeyPairSigner;
  seller: KeyPairSigner;
  buyer: KeyPairSigner;
  financier: KeyPairSigner;
  financier2: KeyPairSigner;
  inspector: KeyPairSigner;
  eudr: KeyPairSigner;
  surveyor: KeyPairSigner;
  stranger: KeyPairSigner;
  mint: Address;
  otherMint: Address;
  ata: (owner: Address, mint?: Address) => Promise<Address>;
  nextDealId: () => bigint;
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
  expect(res, "transaction should fail").toBeInstanceOf(
    FailedTransactionMetadata,
  );
  const logs = logsOf(res).join("\n");
  expect(logs, `expected error ${code}`).toContain(`Error Number: ${code}.`);
}

/** `init` on an existing PDA fails in the System Program before any Selo check. */
export function expectAlreadyInUse(res: TxResult) {
  expectFailure(res);
  expect(logsOf(res).join("\n")).toContain("already in use");
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
  ConstraintDuplicateMutableAccount: 2040,
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

export function fetchDeal(svm: LiteSVM, deal: Address) {
  const acc = decodeDeal(svm.getAccount(deal));
  assertAccountExists(acc);
  return acc.data;
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

/** A non-ATA token account (e.g. a second account for the same owner). */
export async function createTokenAccount(
  ctx: Ctx,
  owner: Address,
  mint: Address = ctx.mint,
): Promise<Address> {
  const account = await generateKeyPairSigner();
  const space = BigInt(getTokenSize());
  await sendOk(
    ctx.svm,
    [
      getCreateAccountInstruction({
        payer: ctx.faucet,
        newAccount: account,
        lamports: lamports(ctx.svm.minimumBalanceForRentExemption(space)),
        space,
        programAddress: TOKEN_PROGRAM_ADDRESS,
      }),
      getInitializeAccount3Instruction({
        account: account.address,
        mint,
        owner,
      }),
    ],
    ctx.faucet,
  );
  return account.address;
}

export async function mintTo(
  ctx: Ctx,
  owner: Address,
  amount: bigint,
  mint: Address = ctx.mint,
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

  const [
    faucet,
    seller,
    buyer,
    financier,
    financier2,
    inspector,
    eudr,
    surveyor,
    stranger,
  ] = await Promise.all(Array.from({ length: 9 }, () => funded(svm)));
  const mint = await createMint(svm, faucet);
  const otherMint = await createMint(svm, faucet);

  let dealId = 0n;
  const ctx: Ctx = {
    svm,
    faucet,
    seller,
    buyer,
    financier,
    financier2,
    inspector,
    eudr,
    surveyor,
    stranger,
    mint,
    otherMint,
    ata: async (owner, m = mint) =>
      (
        await findAssociatedTokenPda({
          owner,
          mint: m,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        })
      )[0],
    nextDealId: () => ++dealId,
  };

  await mintTo(ctx, buyer.address, 1_000_000n * USDC);
  await mintTo(ctx, financier.address, 500_000n * USDC);
  await mintTo(ctx, financier2.address, 500_000n * USDC);
  await mintTo(ctx, seller.address, 0n);
  await mintTo(ctx, stranger.address, 0n);
  await mintTo(ctx, buyer.address, 1_000n * USDC, otherMint);
  return ctx;
}

// ---------------------------------------------------------------- instructions

export interface DealTerms {
  dealId: bigint;
  buyer: Address;
  amount: bigint;
  maxAdvanceBps: number;
  advanceFeeBps: number;
  requiredMilestones: number;
  attesters: AttesterEntryArgs[];
  expiresAt: bigint;
  paymentDueAt: bigint;
}

export function defaultTerms(ctx: Ctx): DealTerms {
  return {
    dealId: ctx.nextDealId(),
    buyer: ctx.buyer.address,
    amount: AMOUNT,
    maxAdvanceBps: MAX_ADVANCE_BPS,
    advanceFeeBps: ADVANCE_FEE_BPS,
    requiredMilestones: DEFAULT_REQUIRED_MILESTONES,
    attesters: [
      {
        key: ctx.inspector.address,
        milestones: Milestone.INSPECTED | Milestone.SHIPPED,
      },
      { key: ctx.eudr.address, milestones: Milestone.EUDR_COMPLIANT },
      { key: ctx.surveyor.address, milestones: Milestone.DELIVERED },
    ],
    expiresAt: NOW + 7n * DAY,
    paymentDueAt: NOW + 30n * DAY,
  };
}

export async function createDealIx(
  ctx: Ctx,
  overrides: Partial<DealTerms> = {},
  seller: KeyPairSigner = ctx.seller,
  usdcMint: Address = ctx.mint,
) {
  const terms = { ...defaultTerms(ctx), ...overrides };
  const deal = await findDealPda(seller.address, terms.dealId);
  const ix = getCreateDealInstruction({ seller, deal, usdcMint, ...terms });
  return { deal, terms, ix };
}

export async function createDeal(ctx: Ctx, overrides: Partial<DealTerms> = {}) {
  const { deal, terms, ix } = await createDealIx(ctx, overrides);
  const res = await sendOk(ctx.svm, [ix], ctx.seller);
  return { deal, terms, res };
}

export async function fundIx(
  ctx: Ctx,
  deal: Address,
  buyer: KeyPairSigner = ctx.buyer,
  buyerToken?: Address,
) {
  return getFundEscrowInstructionAsync({
    buyer,
    deal,
    usdcMint: ctx.mint,
    buyerToken: buyerToken ?? (await ctx.ata(buyer.address)),
  });
}

/** Created + funded deal. */
export async function fundedDeal(ctx: Ctx, overrides: Partial<DealTerms> = {}) {
  const created = await createDeal(ctx, overrides);
  await sendOk(ctx.svm, [await fundIx(ctx, created.deal)], ctx.buyer);
  const [vault] = await findVaultPda({ deal: created.deal });
  return { ...created, vault };
}

export function blHash(number = BL.number, issuer = BL.issuer) {
  return docHash({ docType: DocType.BillOfLading, issuer, number });
}

export async function registerIx(
  ctx: Ctx,
  deal: Address,
  hash: Uint8Array,
  docType: number = DocType.BillOfLading,
  seller: KeyPairSigner = ctx.seller,
) {
  return getRegisterDocumentInstructionAsync({
    seller,
    deal,
    docHash: hash,
    docType,
  });
}

export async function registerBl(ctx: Ctx, deal: Address, number = BL.number) {
  const hash = blHash(number);
  await sendOk(ctx.svm, [await registerIx(ctx, deal, hash)], ctx.seller);
  const [record] = await findDocRecordPda({ docHash: hash });
  return record;
}

export async function attestIx(
  deal: Address,
  attester: KeyPairSigner,
  milestone: number,
  evidenceHash: Uint8Array = EVIDENCE,
) {
  return getAttestMilestoneInstruction({
    attester,
    deal,
    milestoneRecord: await findMilestonePda(deal, milestone),
    milestone,
    evidenceHash,
  });
}

export async function attest(
  ctx: Ctx,
  deal: Address,
  attester: KeyPairSigner,
  milestone: number,
) {
  return sendOk(ctx.svm, [await attestIx(deal, attester, milestone)], attester);
}

export async function advanceIx(
  ctx: Ctx,
  deal: Address,
  billOfLading: Address,
  amount: bigint,
  opts: {
    financier?: KeyPairSigner;
    financierToken?: Address;
    sellerToken?: Address;
    usdcMint?: Address;
  } = {},
) {
  const financier = opts.financier ?? ctx.financier;
  return getAdvanceInstruction({
    financier,
    deal,
    billOfLading,
    usdcMint: opts.usdcMint ?? ctx.mint,
    financierToken: opts.financierToken ?? (await ctx.ata(financier.address)),
    sellerToken: opts.sellerToken ?? (await ctx.ata(ctx.seller.address)),
    amount,
  });
}

export async function settleIx(
  ctx: Ctx,
  deal: Address,
  opts: {
    financierToken?: Address;
    sellerToken?: Address;
    vault?: Address;
  } = {},
) {
  return getSettleInstructionAsync({
    deal,
    vault: opts.vault,
    usdcMint: ctx.mint,
    sellerToken: opts.sellerToken ?? (await ctx.ata(ctx.seller.address)),
    financierToken: opts.financierToken,
    buyer: ctx.buyer.address,
  });
}

export async function refundIx(
  ctx: Ctx,
  deal: Address,
  opts: { buyerToken?: Address } = {},
) {
  return getRefundInstructionAsync({
    deal,
    usdcMint: ctx.mint,
    buyerToken: opts.buyerToken ?? (await ctx.ata(ctx.buyer.address)),
    buyer: ctx.buyer.address,
  });
}

export function cancelIx(deal: Address, authority: KeyPairSigner) {
  return getCancelInstruction({ authority, deal });
}

/** Funded deal with B/L registered and every default milestone attested. */
export async function shippedDeal(
  ctx: Ctx,
  overrides: Partial<DealTerms> = {},
) {
  const d = await fundedDeal(ctx, overrides);
  const bl = await registerBl(ctx, d.deal);
  await attest(ctx, d.deal, ctx.inspector, Milestone.INSPECTED);
  await attest(ctx, d.deal, ctx.inspector, Milestone.SHIPPED);
  return { ...d, bl };
}
