import { beforeEach, describe, expect, it } from "vitest";
import {
  DealStatus,
  DocType,
  Milestone,
  SELO_ERROR__ADVANCE_EXCEEDS_LIMIT,
  SELO_ERROR__BILL_OF_LADING_MISMATCH,
  SELO_ERROR__FINANCIER_IS_PARTY,
  SELO_ERROR__INVALID_AMOUNT,
  SELO_ERROR__INVALID_STATUS,
  SELO_ERROR__NOT_SHIPPED,
  SELO_ERROR__PAYMENT_DUE,
  docHash,
  findDocRecordPda,
  parseAdvanceFundedEvent,
} from "@selo/sdk";
import {
  ADVANCE_FEE_BPS,
  AMOUNT,
  AnchorErr,
  type Ctx,
  MAX_ADVANCE_BPS,
  advanceIx,
  attest,
  createTokenAccount,
  mintTo,
  eventsOf,
  expectError,
  fetchDeal,
  fundedDeal,
  registerBl,
  registerIx,
  send,
  sendOk,
  setTime,
  setup,
  shippedDeal,
  tokenBalance,
} from "./helpers/selo";

const MAX_ADVANCE = (AMOUNT * BigInt(MAX_ADVANCE_BPS)) / 10_000n;

describe("advance", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("pays the seller and records principal + fee", async () => {
    const { deal, bl } = await shippedDeal(ctx);
    const sellerToken = await ctx.ata(ctx.seller.address);
    const financierToken = await ctx.ata(ctx.financier.address);
    const financierBefore = tokenBalance(ctx.svm, financierToken);

    const res = await sendOk(
      ctx.svm,
      [await advanceIx(ctx, deal, bl, MAX_ADVANCE)],
      ctx.financier,
    );

    expect(tokenBalance(ctx.svm, sellerToken)).toBe(MAX_ADVANCE);
    expect(tokenBalance(ctx.svm, financierToken)).toBe(
      financierBefore - MAX_ADVANCE,
    );
    const d = fetchDeal(ctx.svm, deal);
    const repay =
      MAX_ADVANCE + (MAX_ADVANCE * BigInt(ADVANCE_FEE_BPS)) / 10_000n;
    expect(d.status).toBe(DealStatus.Advanced);
    expect(d.financier).toBe(ctx.financier.address);
    expect(d.advancedAmount).toBe(MAX_ADVANCE);
    expect(d.repayAmount).toBe(repay);
    expect(eventsOf(res, parseAdvanceFundedEvent)[0].repayAmount).toBe(repay);
  });

  it("rejects an amount above max_advance_bps", async () => {
    const { deal, bl } = await shippedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, bl, MAX_ADVANCE + 1n)],
        ctx.financier,
      ),
      SELO_ERROR__ADVANCE_EXCEEDS_LIMIT,
    );
  });

  it("rejects a zero amount", async () => {
    const { deal, bl } = await shippedDeal(ctx);
    expectError(
      await send(ctx.svm, [await advanceIx(ctx, deal, bl, 0n)], ctx.financier),
      SELO_ERROR__INVALID_AMOUNT,
    );
  });

  it("requires SHIPPED", async () => {
    const { deal } = await fundedDeal(ctx);
    const bl = await registerBl(ctx, deal);
    await attest(ctx, deal, ctx.inspector, Milestone.INSPECTED);
    expectError(
      await send(ctx.svm, [await advanceIx(ctx, deal, bl, 1n)], ctx.financier),
      SELO_ERROR__NOT_SHIPPED,
    );
  });

  it("requires this deal's B/L (none registered)", async () => {
    const other = await shippedDeal(ctx);
    const { deal } = await fundedDeal(ctx);
    await attest(ctx, deal, ctx.inspector, Milestone.SHIPPED);
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, other.bl, 1n)],
        ctx.financier,
      ),
      SELO_ERROR__BILL_OF_LADING_MISMATCH,
    );
  });

  it("rejects a B/L registered on another deal", async () => {
    const a = await shippedDeal(ctx);
    const b = await fundedDeal(ctx);
    await registerBl(ctx, b.deal, "MAEU-777");
    await attest(ctx, b.deal, ctx.inspector, Milestone.SHIPPED);
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, b.deal, a.bl, 1n)],
        ctx.financier,
      ),
      SELO_ERROR__BILL_OF_LADING_MISMATCH,
    );
  });

  it("rejects a non-B/L document of the same deal", async () => {
    const { deal } = await shippedDeal(ctx);
    const invoice = docHash({
      docType: DocType.CommercialInvoice,
      issuer: "12345678000190",
      number: "INV-1",
    });
    await sendOk(
      ctx.svm,
      [await registerIx(ctx, deal, invoice, DocType.CommercialInvoice)],
      ctx.seller,
    );
    const [invoiceRecord] = await findDocRecordPda({ docHash: invoice });
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, invoiceRecord, 1n)],
        ctx.financier,
      ),
      SELO_ERROR__BILL_OF_LADING_MISMATCH,
    );
  });

  it("allows only one advance", async () => {
    const { deal, bl } = await shippedDeal(ctx);
    await sendOk(
      ctx.svm,
      [await advanceIx(ctx, deal, bl, 1_000n)],
      ctx.financier,
    );
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, bl, 1_000n, { financier: ctx.financier2 })],
        ctx.financier2,
      ),
      SELO_ERROR__INVALID_STATUS,
    );
  });

  it("rejects the buyer or the seller as financier", async () => {
    const { deal, bl } = await shippedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, bl, 1n, { financier: ctx.buyer })],
        ctx.buyer,
      ),
      SELO_ERROR__FINANCIER_IS_PARTY,
    );
    // Seller paying from a second token account of their own.
    const sellerSecondAccount = await createTokenAccount(
      ctx,
      ctx.seller.address,
    );
    await mintTo(ctx, ctx.seller.address, 1_000n);
    expectError(
      await send(
        ctx.svm,
        [
          await advanceIx(ctx, deal, bl, 1n, {
            financier: ctx.seller,
            financierToken: sellerSecondAccount,
          }),
        ],
        ctx.seller,
      ),
      SELO_ERROR__FINANCIER_IS_PARTY,
    );
    // Same account on both sides is rejected by Anchor before the handler.
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, bl, 1n, { financier: ctx.seller })],
        ctx.seller,
      ),
      AnchorErr.ConstraintDuplicateMutableAccount,
    );
  });

  it("rejects a seller token account owned by someone else", async () => {
    const { deal, bl } = await shippedDeal(ctx);
    const strangerToken = await ctx.ata(ctx.stranger.address);
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, bl, 1n, { sellerToken: strangerToken })],
        ctx.financier,
      ),
      AnchorErr.ConstraintTokenOwner,
    );
  });

  it("rejects token accounts or mint of another mint", async () => {
    const { deal, bl } = await shippedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await advanceIx(ctx, deal, bl, 1n, { usdcMint: ctx.otherMint })],
        ctx.financier,
      ),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("closes once payment is due", async () => {
    const { deal, bl, terms } = await shippedDeal(ctx);
    setTime(ctx.svm, terms.paymentDueAt);
    expectError(
      await send(ctx.svm, [await advanceIx(ctx, deal, bl, 1n)], ctx.financier),
      SELO_ERROR__PAYMENT_DUE,
    );
  });
});
