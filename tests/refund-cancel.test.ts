import { beforeEach, describe, expect, it } from "vitest";
import {
  DealStatus,
  Milestone,
  SELO_ERROR__ALREADY_SHIPPED,
  SELO_ERROR__DEAL_NOT_EXPIRED,
  SELO_ERROR__INVALID_PARTIES,
  SELO_ERROR__INVALID_STATUS,
  parseDealCancelledEvent,
  parseDealRefundedEvent,
} from "@selo/sdk";
import {
  AMOUNT,
  AnchorErr,
  type Ctx,
  accountExists,
  attest,
  cancelIx,
  createDeal,
  createDealIx,
  eventsOf,
  expectAlreadyInUse,
  expectError,
  fetchDeal,
  fundedDeal,
  refundIx,
  send,
  sendOk,
  setTime,
  settleIx,
  setup,
  shippedDeal,
  tokenBalance,
  USDC,
} from "./helpers/selo";

describe("refund", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("returns the escrow to the buyer if nothing shipped by expires_at", async () => {
    const { deal, vault, terms } = await fundedDeal(ctx);
    await attest(ctx, deal, ctx.inspector, Milestone.INSPECTED);
    const buyerToken = await ctx.ata(ctx.buyer.address);
    const before = tokenBalance(ctx.svm, buyerToken);

    setTime(ctx.svm, terms.expiresAt + 1n);
    const res = await sendOk(
      ctx.svm,
      [await refundIx(ctx, deal)],
      ctx.stranger,
    );

    expect(tokenBalance(ctx.svm, buyerToken)).toBe(before + AMOUNT);
    expect(accountExists(ctx.svm, vault)).toBe(false);
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Refunded);
    expect(eventsOf(res, parseDealRefundedEvent)[0].amount).toBe(AMOUNT);
  });

  it("fails before expires_at", async () => {
    const { deal, terms } = await fundedDeal(ctx);
    setTime(ctx.svm, terms.expiresAt);
    expectError(
      await send(ctx.svm, [await refundIx(ctx, deal)], ctx.buyer),
      SELO_ERROR__DEAL_NOT_EXPIRED,
    );
  });

  it("buyer cannot refund after SHIPPED, even past expires_at", async () => {
    const { deal, terms } = await shippedDeal(ctx);
    setTime(ctx.svm, terms.paymentDueAt + 365n * 86_400n);
    expectError(
      await send(ctx.svm, [await refundIx(ctx, deal)], ctx.buyer),
      SELO_ERROR__ALREADY_SHIPPED,
    );
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Funded);
  });

  it("rejects paying the refund to someone other than the buyer", async () => {
    const { deal, terms } = await fundedDeal(ctx);
    setTime(ctx.svm, terms.expiresAt + 1n);
    const strangerToken = await ctx.ata(ctx.stranger.address);
    expectError(
      await send(
        ctx.svm,
        [await refundIx(ctx, deal, { buyerToken: strangerToken })],
        ctx.stranger,
      ),
      AnchorErr.ConstraintTokenOwner,
    );
  });

  it("cannot refund a settled deal", async () => {
    const d = await shippedDeal(ctx);
    await attest(ctx, d.deal, ctx.eudr, Milestone.EUDR_COMPLIANT);
    setTime(ctx.svm, d.terms.paymentDueAt);
    await sendOk(ctx.svm, [await settleIx(ctx, d.deal)], ctx.stranger);
    expectError(
      await send(ctx.svm, [await refundIx(ctx, d.deal)], ctx.buyer),
      AnchorErr.AccountNotInitialized,
    );
  });

  it("cannot refund an unfunded deal", async () => {
    const { deal, terms } = await createDeal(ctx);
    setTime(ctx.svm, terms.expiresAt + 1n);
    // No vault exists yet.
    expectError(
      await send(ctx.svm, [await refundIx(ctx, deal)], ctx.buyer),
      AnchorErr.AccountNotInitialized,
    );
  });
});

describe("cancel", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("seller cancels an unfunded deal", async () => {
    const { deal } = await createDeal(ctx);
    const res = await sendOk(ctx.svm, [cancelIx(deal, ctx.seller)], ctx.seller);
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Cancelled);
    expect(eventsOf(res, parseDealCancelledEvent)[0].by).toBe(
      ctx.seller.address,
    );
  });

  it("buyer can cancel an unfunded deal", async () => {
    const { deal } = await createDeal(ctx);
    await sendOk(ctx.svm, [cancelIx(deal, ctx.buyer)], ctx.buyer);
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Cancelled);
  });

  it("audit F-1: a cancelled deal address cannot be re-created with other terms", async () => {
    const reviewed = await createDealIx(ctx);
    await sendOk(ctx.svm, [reviewed.ix], ctx.seller);
    const swapped = await createDealIx(ctx, {
      dealId: reviewed.terms.dealId,
      amount: 900_000n * USDC,
      attesters: [{ key: ctx.stranger.address, milestones: 0x0f }],
    });
    expect(swapped.deal).toBe(reviewed.deal);

    expectAlreadyInUse(
      await send(
        ctx.svm,
        [cancelIx(reviewed.deal, ctx.seller), swapped.ix],
        ctx.seller,
      ),
    );
    expect(fetchDeal(ctx.svm, reviewed.deal).amount).toBe(AMOUNT);
  });

  it("cannot cancel twice", async () => {
    const { deal } = await createDeal(ctx);
    await sendOk(ctx.svm, [cancelIx(deal, ctx.seller)], ctx.seller);
    expectError(
      await send(ctx.svm, [cancelIx(deal, ctx.buyer)], ctx.buyer),
      SELO_ERROR__INVALID_STATUS,
    );
  });

  it("rejects a third party", async () => {
    const { deal } = await createDeal(ctx);
    expectError(
      await send(ctx.svm, [cancelIx(deal, ctx.stranger)], ctx.stranger),
      SELO_ERROR__INVALID_PARTIES,
    );
  });

  it("rejects cancelling after funding", async () => {
    const { deal } = await fundedDeal(ctx);
    expectError(
      await send(ctx.svm, [cancelIx(deal, ctx.seller)], ctx.seller),
      SELO_ERROR__INVALID_STATUS,
    );
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Funded);
  });
});
