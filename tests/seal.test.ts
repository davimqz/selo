import { describe, expect, it } from "vitest";
import { lamports } from "@solana/kit";
import {
  SELO_ERROR__DUE_DATE_IN_PAST,
  SELO_ERROR__INVALID_AMOUNT,
  SELO_ERROR__INVALID_BUYER,
  SELO_ERROR__INVALID_CURRENCY,
  SELO_ERROR__INVALID_STATUS,
  SELO_ERROR__INVOICE_ALREADY_SEALED,
  SELO_ERROR__PAUSED,
  SealStatus,
  getCancelSealInstruction,
  getSetPausedInstructionAsync,
  parseInvoiceCancelledEvent,
  parseInvoiceSealedEvent,
  sealArgs,
} from "@selo/sdk";
import {
  AnchorErr,
  INVOICE,
  NOW,
  accountExists,
  eventsOf,
  expectError,
  fetchSeal,
  sealIx,
  sealPdaOf,
  send,
  sendOk,
  setupRegistry,
} from "./helpers/selo";

const ADDRESS_DEFAULT = "11111111111111111111111111111111";

describe("seal_invoice", () => {
  it("creates the seal with only the hash and clear-text terms", async () => {
    const { ctx } = await setupRegistry();
    const res = await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);

    const sealPda = await sealPdaOf();
    const args = sealArgs(INVOICE);
    const seal = fetchSeal(ctx.svm, sealPda);
    expect(new Uint8Array(seal.invoiceHash)).toEqual(args.invoiceHash);
    expect(seal.supplier).toBe(ctx.supplier.address);
    expect(seal.buyer).toBe(ctx.buyer.address);
    expect(seal.faceAmount).toBe(args.faceAmount);
    expect(new TextDecoder().decode(new Uint8Array(seal.currency))).toBe("USD");
    expect(seal.dueTs).toBe(args.dueTs);
    expect(seal.status).toBe(SealStatus.Sealed);
    expect(seal.buyerAttested).toBe(false);
    expect(seal.lender).toBe(ADDRESS_DEFAULT);
    expect(seal.lockedAt).toBe(0n);
    expect(seal.createdAt).toBe(NOW);

    const [event] = eventsOf(res, parseInvoiceSealedEvent);
    expect(event.seal).toBe(sealPda);
    expect(event.supplier).toBe(ctx.supplier.address);
    expect(event.faceAmount).toBe(args.faceAmount);
  });

  // CLAUDE.md section 11, test 1.
  describe("the same invoice cannot be sealed twice", () => {
    it("identical data", async () => {
      const { ctx } = await setupRegistry();
      await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
      expectError(
        await send(ctx.svm, [await sealIx(ctx)], ctx.supplier),
        SELO_ERROR__INVOICE_ALREADY_SEALED,
      );
    });

    it("typed differently (lowercase, spaces, punctuation)", async () => {
      const { ctx } = await setupRegistry();
      await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
      const retyped = {
        buyerTaxId: "buyer 001",
        supplierTaxId: "sup.042",
        number: "  inv-2026- 0001 ",
        amount: "001250000",
        currency: "usd",
        dueDate: " 2027-04-15",
      };
      expectError(
        await send(ctx.svm, [await sealIx(ctx, retyped)], ctx.supplier),
        SELO_ERROR__INVOICE_ALREADY_SEALED,
      );
    });

    it("by another wallet with different clear-text terms", async () => {
      const { ctx } = await setupRegistry();
      await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
      const ix = await sealIx(ctx, INVOICE, {
        supplier: ctx.stranger,
        faceAmount: 1n,
      });
      expectError(
        await send(ctx.svm, [ix], ctx.stranger),
        SELO_ERROR__INVOICE_ALREADY_SEALED,
      );
    });

    it("after it was cancelled", async () => {
      const { ctx } = await setupRegistry();
      await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
      await sendOk(
        ctx.svm,
        [
          await getCancelSealInstruction({
            supplier: ctx.supplier,
            seal: await sealPdaOf(),
          }),
        ],
        ctx.supplier,
      );
      expectError(
        await send(ctx.svm, [await sealIx(ctx)], ctx.supplier),
        SELO_ERROR__INVOICE_ALREADY_SEALED,
      );
    });
  });

  it("still seals when someone pre-funded the PDA with lamports", async () => {
    const { ctx } = await setupRegistry();
    const sealPda = await sealPdaOf();
    ctx.svm.airdrop(sealPda, lamports(1_000_000n));
    await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
    expect(fetchSeal(ctx.svm, sealPda).status).toBe(SealStatus.Sealed);
  });

  it("is blocked while paused", async () => {
    const { ctx } = await setupRegistry();
    await sendOk(
      ctx.svm,
      [await getSetPausedInstructionAsync({ admin: ctx.admin, paused: true })],
      ctx.admin,
    );
    expectError(
      await send(ctx.svm, [await sealIx(ctx)], ctx.supplier),
      SELO_ERROR__PAUSED,
    );
  });

  it.each<[string, Parameters<typeof sealIx>[2], number]>([
    ["zero face amount", { faceAmount: 0n }, SELO_ERROR__INVALID_AMOUNT],
    ["due date now", { dueTs: NOW }, SELO_ERROR__DUE_DATE_IN_PAST],
    ["due date in the past", { dueTs: NOW - 1n }, SELO_ERROR__DUE_DATE_IN_PAST],
    [
      "lowercase currency",
      { currency: new TextEncoder().encode("usd") },
      SELO_ERROR__INVALID_CURRENCY,
    ],
    [
      "non-letter currency",
      { currency: Uint8Array.of(0x55, 0x24, 0x44) },
      SELO_ERROR__INVALID_CURRENCY,
    ],
    [
      "default buyer",
      { buyer: ADDRESS_DEFAULT as never },
      SELO_ERROR__INVALID_BUYER,
    ],
  ])("rejects %s", async (_, overrides, code) => {
    const { ctx } = await setupRegistry();
    expectError(
      await send(
        ctx.svm,
        [await sealIx(ctx, INVOICE, overrides)],
        ctx.supplier,
      ),
      code,
    );
  });

  it("rejects the supplier as buyer", async () => {
    const { ctx } = await setupRegistry();
    const ix = await sealIx(ctx, INVOICE, { buyer: ctx.supplier.address });
    expectError(
      await send(ctx.svm, [ix], ctx.supplier),
      SELO_ERROR__INVALID_BUYER,
    );
  });

  it("rejects a seal account that does not match the hash", async () => {
    const { ctx } = await setupRegistry();
    const ix = await sealIx(ctx);
    const otherPda = await sealPdaOf({ ...INVOICE, number: "INV-OTHER" });
    const accounts = ix.accounts.map((a, i) =>
      i === 2 ? { ...a, address: otherPda } : a,
    );
    expectError(
      await send(ctx.svm, [{ ...ix, accounts }], ctx.supplier),
      AnchorErr.ConstraintSeeds,
    );
    expect(accountExists(ctx.svm, otherPda)).toBe(false);
  });
});

describe("cancel_seal", () => {
  async function sealed() {
    const reg = await setupRegistry();
    await sendOk(reg.ctx.svm, [await sealIx(reg.ctx)], reg.ctx.supplier);
    return { ...reg, sealPda: await sealPdaOf() };
  }

  it("marks the seal cancelled and keeps the account", async () => {
    const { ctx, sealPda } = await sealed();
    const res = await sendOk(
      ctx.svm,
      [
        await getCancelSealInstruction({
          supplier: ctx.supplier,
          seal: sealPda,
        }),
      ],
      ctx.supplier,
    );
    expect(fetchSeal(ctx.svm, sealPda).status).toBe(SealStatus.Cancelled);
    const [event] = eventsOf(res, parseInvoiceCancelledEvent);
    expect(event.seal).toBe(sealPda);
  });

  it("rejects anyone but the supplier", async () => {
    const { ctx, sealPda } = await sealed();
    const ix = await getCancelSealInstruction({
      supplier: ctx.buyer,
      seal: sealPda,
    });
    expectError(
      await send(ctx.svm, [ix], ctx.buyer),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("only works while Sealed", async () => {
    const { ctx, sealPda } = await sealed();
    const cancel = async () =>
      send(
        ctx.svm,
        [
          await getCancelSealInstruction({
            supplier: ctx.supplier,
            seal: sealPda,
          }),
        ],
        ctx.supplier,
      );
    await cancel();
    expectError(await cancel(), SELO_ERROR__INVALID_STATUS);
  });
});
