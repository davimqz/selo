import { beforeEach, describe, expect, it } from "vitest";
import {
  DealStatus,
  Milestone,
  SELO_ERROR__DOCUMENT_ALREADY_REGISTERED,
  SELO_ERROR__INVALID_STATUS,
  SELO_ERROR__MISSING_MILESTONES,
  SELO_ERROR__PAYMENT_NOT_DUE,
  parseDealSettledEvent,
} from "@selo/sdk";
import {
  ADVANCE_FEE_BPS,
  AMOUNT,
  AnchorErr,
  type Ctx,
  MAX_ADVANCE_BPS,
  accountExists,
  advanceIx,
  attest,
  blHash,
  eventsOf,
  expectError,
  fetchDeal,
  fundedDeal,
  registerBl,
  registerIx,
  send,
  sendOk,
  setTime,
  settleIx,
  setup,
  shippedDeal,
  tokenBalance,
} from "./helpers/selo";

const MAX_ADVANCE = (AMOUNT * BigInt(MAX_ADVANCE_BPS)) / 10_000n;
const REPAY = MAX_ADVANCE + (MAX_ADVANCE * BigInt(ADVANCE_FEE_BPS)) / 10_000n;

describe("settle", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  /** Shipped deal with every default milestone attested. */
  async function completeDeal() {
    const d = await shippedDeal(ctx);
    await attest(ctx, d.deal, ctx.eudr, Milestone.EUDR_COMPLIANT);
    return d;
  }

  it("repays the financier first, then pays the seller, and closes the vault", async () => {
    const { deal, bl, vault, terms } = await completeDeal();
    await sendOk(
      ctx.svm,
      [await advanceIx(ctx, deal, bl, MAX_ADVANCE)],
      ctx.financier,
    );
    const financierToken = await ctx.ata(ctx.financier.address);
    const sellerToken = await ctx.ata(ctx.seller.address);
    const financierBefore = tokenBalance(ctx.svm, financierToken);
    const sellerBefore = tokenBalance(ctx.svm, sellerToken);

    setTime(ctx.svm, terms.paymentDueAt);
    // Permissionless crank: a stranger pays the fee.
    const res = await sendOk(
      ctx.svm,
      [await settleIx(ctx, deal, { financierToken })],
      ctx.stranger,
    );

    expect(tokenBalance(ctx.svm, financierToken)).toBe(financierBefore + REPAY);
    expect(tokenBalance(ctx.svm, sellerToken)).toBe(
      sellerBefore + AMOUNT - REPAY,
    );
    expect(accountExists(ctx.svm, vault)).toBe(false);
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Settled);
    const [event] = eventsOf(res, parseDealSettledEvent);
    expect(event.toFinancier).toBe(REPAY);
    expect(event.toSeller).toBe(AMOUNT - REPAY);
  });

  it("pays everything to the seller when there was no advance", async () => {
    const { deal, terms } = await completeDeal();
    setTime(ctx.svm, terms.paymentDueAt);
    await sendOk(ctx.svm, [await settleIx(ctx, deal)], ctx.stranger);
    expect(tokenBalance(ctx.svm, await ctx.ata(ctx.seller.address))).toBe(
      AMOUNT,
    );
  });

  it("does not need the buyer: DELIVERED attested by the destination surveyor", async () => {
    const d = await fundedDeal(ctx, {
      requiredMilestones: Milestone.SHIPPED | Milestone.DELIVERED,
    });
    await attest(ctx, d.deal, ctx.inspector, Milestone.SHIPPED);
    await attest(ctx, d.deal, ctx.surveyor, Milestone.DELIVERED);
    setTime(ctx.svm, d.terms.paymentDueAt);
    await sendOk(ctx.svm, [await settleIx(ctx, d.deal)], ctx.surveyor);
    expect(fetchDeal(ctx.svm, d.deal).status).toBe(DealStatus.Settled);
  });

  it("fails before payment_due_at", async () => {
    const { deal, terms } = await completeDeal();
    setTime(ctx.svm, terms.paymentDueAt - 1n);
    expectError(
      await send(ctx.svm, [await settleIx(ctx, deal)], ctx.stranger),
      SELO_ERROR__PAYMENT_NOT_DUE,
    );
  });

  it("fails while a required milestone is missing", async () => {
    const { deal, terms } = await shippedDeal(ctx); // EUDR not attested
    setTime(ctx.svm, terms.paymentDueAt);
    expectError(
      await send(ctx.svm, [await settleIx(ctx, deal)], ctx.stranger),
      SELO_ERROR__MISSING_MILESTONES,
    );
  });

  it("requires the financier token account when advanced", async () => {
    const { deal, bl, terms } = await completeDeal();
    await sendOk(
      ctx.svm,
      [await advanceIx(ctx, deal, bl, 1_000n)],
      ctx.financier,
    );
    setTime(ctx.svm, terms.paymentDueAt);
    expectError(
      await send(ctx.svm, [await settleIx(ctx, deal)], ctx.stranger),
      SELO_ERROR__INVALID_STATUS,
    );
  });

  it("rejects a financier token account owned by someone else", async () => {
    const { deal, bl, terms } = await completeDeal();
    await sendOk(
      ctx.svm,
      [await advanceIx(ctx, deal, bl, 1_000n)],
      ctx.financier,
    );
    setTime(ctx.svm, terms.paymentDueAt);
    const strangerToken = await ctx.ata(ctx.stranger.address);
    expectError(
      await send(
        ctx.svm,
        [await settleIx(ctx, deal, { financierToken: strangerToken })],
        ctx.stranger,
      ),
      AnchorErr.ConstraintTokenOwner,
    );
  });

  it("rejects a seller payout account owned by someone else", async () => {
    const { deal, terms } = await completeDeal();
    setTime(ctx.svm, terms.paymentDueAt);
    const strangerToken = await ctx.ata(ctx.stranger.address);
    expectError(
      await send(
        ctx.svm,
        [await settleIx(ctx, deal, { sellerToken: strangerToken })],
        ctx.stranger,
      ),
      AnchorErr.ConstraintTokenOwner,
    );
  });

  it("rejects the vault of another deal", async () => {
    const a = await completeDeal();
    const b = await fundedDeal(ctx);
    setTime(ctx.svm, a.terms.paymentDueAt);
    expectError(
      await send(
        ctx.svm,
        [await settleIx(ctx, a.deal, { vault: b.vault })],
        ctx.stranger,
      ),
      AnchorErr.ConstraintSeeds,
    );
  });

  it("cannot settle twice", async () => {
    const { deal, terms } = await completeDeal();
    setTime(ctx.svm, terms.paymentDueAt);
    await sendOk(ctx.svm, [await settleIx(ctx, deal)], ctx.stranger);
    // The vault was closed on the first settlement.
    expectError(
      await send(ctx.svm, [await settleIx(ctx, deal)], ctx.stranger),
      AnchorErr.AccountNotInitialized,
    );
  });
});

describe("demo flow", () => {
  it("runs the four demo steps end to end", async () => {
    const ctx = await setup();
    const sellerToken = await ctx.ata(ctx.seller.address);
    const financierToken = await ctx.ata(ctx.financier.address);

    // 1. Exporter creates the deal, buyer funds, exporter registers the B/L.
    const { deal, terms } = await fundedDeal(ctx);
    const bl = await registerBl(ctx, deal);

    // 2. Same B/L pledged on a second deal with another financier → rejected on-chain.
    const second = await fundedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await registerIx(ctx, second.deal, blHash("maeu 123-456"))],
        ctx.seller,
      ),
      SELO_ERROR__DOCUMENT_ALREADY_REGISTERED,
    );

    // 3. Inspector attests; financier advances to the exporter.
    await attest(ctx, deal, ctx.inspector, Milestone.INSPECTED);
    await attest(ctx, deal, ctx.inspector, Milestone.SHIPPED);
    await attest(ctx, deal, ctx.eudr, Milestone.EUDR_COMPLIANT);
    await sendOk(
      ctx.svm,
      [await advanceIx(ctx, deal, bl, MAX_ADVANCE)],
      ctx.financier,
    );
    expect(tokenBalance(ctx.svm, sellerToken)).toBe(MAX_ADVANCE);

    // 4. At maturity, settle pays the financier, then the exporter.
    const financierBefore = tokenBalance(ctx.svm, financierToken);
    setTime(ctx.svm, terms.paymentDueAt);
    await sendOk(
      ctx.svm,
      [await settleIx(ctx, deal, { financierToken })],
      ctx.stranger,
    );
    expect(tokenBalance(ctx.svm, financierToken)).toBe(financierBefore + REPAY);
    expect(tokenBalance(ctx.svm, sellerToken)).toBe(
      AMOUNT - REPAY + MAX_ADVANCE,
    );
  });
});
