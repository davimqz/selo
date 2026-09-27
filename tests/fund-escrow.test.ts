import { beforeEach, describe, expect, it } from "vitest";
import {
  DealStatus,
  SELO_ERROR__DEAL_EXPIRED,
  SELO_ERROR__INVALID_STATUS,
  findVaultPda,
  getFundEscrowInstructionAsync,
  parseEscrowFundedEvent,
} from "@selo/sdk";
import {
  AMOUNT,
  AnchorErr,
  type Ctx,
  DAY,
  NOW,
  USDC,
  cancelIx,
  createDeal,
  eventsOf,
  expectAlreadyInUse,
  expectError,
  expectFailure,
  fetchDeal,
  fundIx,
  logsOf,
  send,
  sendOk,
  setTime,
  setup,
  tokenBalance,
} from "./helpers/selo";

describe("fund_escrow", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("moves the amount into the deal vault", async () => {
    const { deal } = await createDeal(ctx);
    const buyerToken = await ctx.ata(ctx.buyer.address);
    const before = tokenBalance(ctx.svm, buyerToken);

    const res = await sendOk(ctx.svm, [await fundIx(ctx, deal)], ctx.buyer);

    const [vault] = await findVaultPda({ deal });
    expect(tokenBalance(ctx.svm, vault)).toBe(AMOUNT);
    expect(tokenBalance(ctx.svm, buyerToken)).toBe(before - AMOUNT);
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Funded);
    expect(eventsOf(res, parseEscrowFundedEvent)[0].amount).toBe(AMOUNT);
  });

  it("rejects a signer that is not the buyer", async () => {
    const { deal } = await createDeal(ctx);
    const ix = await fundIx(ctx, deal, ctx.financier);
    expectError(
      await send(ctx.svm, [ix], ctx.financier),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("rejects a buyer token account of another mint", async () => {
    const { deal } = await createDeal(ctx);
    const wrong = await ctx.ata(ctx.buyer.address, ctx.otherMint);
    const ix = await fundIx(ctx, deal, ctx.buyer, wrong);
    expectError(
      await send(ctx.svm, [ix], ctx.buyer),
      AnchorErr.ConstraintTokenMint,
    );
  });

  it("rejects another mint as the deal mint", async () => {
    const { deal } = await createDeal(ctx);
    const ix = await getFundEscrowInstructionAsync({
      buyer: ctx.buyer,
      deal,
      usdcMint: ctx.otherMint,
      buyerToken: await ctx.ata(ctx.buyer.address, ctx.otherMint),
    });
    expectError(
      await send(ctx.svm, [ix], ctx.buyer),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("cannot be funded twice", async () => {
    const { deal } = await createDeal(ctx);
    await sendOk(ctx.svm, [await fundIx(ctx, deal)], ctx.buyer);
    // The vault already exists, so `init` fails before the status check.
    expectAlreadyInUse(
      await send(ctx.svm, [await fundIx(ctx, deal)], ctx.buyer),
    );
    const [vault] = await findVaultPda({ deal });
    expect(tokenBalance(ctx.svm, vault)).toBe(AMOUNT);
  });

  it("rejects funding after expires_at", async () => {
    const { deal, terms } = await createDeal(ctx);
    setTime(ctx.svm, terms.expiresAt + 1n);
    expectError(
      await send(ctx.svm, [await fundIx(ctx, deal)], ctx.buyer),
      SELO_ERROR__DEAL_EXPIRED,
    );
  });

  it("rejects funding a cancelled deal", async () => {
    const { deal } = await createDeal(ctx, { expiresAt: NOW + DAY });
    await sendOk(ctx.svm, [cancelIx(deal, ctx.seller)], ctx.seller);
    expectError(
      await send(ctx.svm, [await fundIx(ctx, deal)], ctx.buyer),
      SELO_ERROR__INVALID_STATUS,
    );
  });

  it("fails without enough USDC", async () => {
    const { deal } = await createDeal(ctx, { amount: 2_000_000n * USDC });
    const res = await send(ctx.svm, [await fundIx(ctx, deal)], ctx.buyer);
    expectFailure(res);
    expect(logsOf(res).join("\n")).toContain("insufficient funds");
    expect(fetchDeal(ctx.svm, deal).status).toBe(DealStatus.Created);
  });
});
