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
  eventsOf,
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

  it("seller cancels an unfunded deal and gets the rent back", async () => {
    const { deal } = await createDeal(ctx);
    const res = await sendOk(
      ctx.svm,
      [cancelIx(ctx, deal, ctx.seller)],
      ctx.seller,
    );
    expect(accountExists(ctx.svm, deal)).toBe(false);
    expect(eventsOf(res, parseDealCancelledEvent)[0].by).toBe(
      ctx.seller.address,
    );
  });

  it("buyer can cancel an unfunded deal", async () => {
    const { deal } = await createDeal(ctx);
    await sendOk(ctx.svm, [cancelIx(ctx, deal, ctx.buyer)], ctx.buyer);
    expect(accountExists(ctx.svm, deal)).toBe(false);
  });

  it("rejects a third party", async () => {
    const { deal } = await createDeal(ctx);
    expectError(
      await send(ctx.svm, [cancelIx(ctx, deal, ctx.stranger)], ctx.stranger),
      SELO_ERROR__INVALID_PARTIES,
    );
  });

  it("rejects cancelling after funding", async () => {
    const { deal } = await fundedDeal(ctx);
    expectError(
      await send(ctx.svm, [cancelIx(ctx, deal, ctx.seller)], ctx.seller),
      SELO_ERROR__INVALID_STATUS,
    );
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Funded);
  });
});
