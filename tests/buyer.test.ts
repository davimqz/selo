/**
 * Verified buyers: only a KYB-verified company can attest, and a lender can
 * only lock if the attesting wallet is the verified company on the invoice.
 */
import { describe, expect, it } from "vitest";
import {
  SELO_ERROR__BUYER_MISMATCH,
  SELO_ERROR__BUYER_NOT_VERIFIED,
  SELO_ERROR__INVALID_BUYER_NAME,
  SealStatus,
  checkInvoice,
  decodeBuyer,
  getRegisterBuyerInstructionAsync,
  getSetBuyerActiveInstructionAsync,
  parseBuyerVerifiedEvent,
  partyIdHash,
  toHex,
} from "@selo/sdk";
import { assertAccountExists } from "@solana/kit";
import {
  AnchorErr,
  type Ctx,
  INVOICE,
  NOW,
  attestIx,
  eventsOf,
  expectError,
  expectFailure,
  fetchSeal,
  lockIx,
  registerBuyer,
  sealIx,
  sealPdaOf,
  send,
  sendOk,
  setupAttested,
  setupRegistry,
  svmRpc,
} from "./helpers/selo";

async function setBuyerActive(ctx: Ctx, active: boolean) {
  await sendOk(
    ctx.svm,
    [
      await getSetBuyerActiveInstructionAsync({
        admin: ctx.admin,
        buyerRecord: ctx.buyerRecord,
        active,
      }),
    ],
    ctx.admin,
  );
}

describe("register_buyer", () => {
  it("binds the wallet to the tax ID hash", async () => {
    const { ctx } = await setupRegistry();
    const acc = decodeBuyer(ctx.svm.getAccount(ctx.buyerRecord));
    assertAccountExists(acc);
    expect(acc.data.authority).toBe(ctx.buyer.address);
    expect(toHex(new Uint8Array(acc.data.taxIdHash))).toBe(
      toHex(partyIdHash(INVOICE.buyerTaxId)),
    );
    expect(acc.data.name).toBe("Buyer Co");
    expect(acc.data.active).toBe(true);
    expect(acc.data.verifiedAt).toBe(NOW);
  });

  it("emits BuyerVerified", async () => {
    const { ctx } = await setupRegistry();
    const res = await sendOk(
      ctx.svm,
      [
        await getRegisterBuyerInstructionAsync({
          admin: ctx.admin,
          buyerAuthority: ctx.stranger.address,
          taxIdHash: partyIdHash("OTHER-CO"),
          name: "Other Co",
        }),
      ],
      ctx.admin,
    );
    const [event] = eventsOf(res, parseBuyerVerifiedEvent);
    expect(event.authority).toBe(ctx.stranger.address);
  });

  it("rejects anyone but the admin", async () => {
    const { ctx } = await setupRegistry();
    const ix = await getRegisterBuyerInstructionAsync({
      admin: ctx.stranger,
      buyerAuthority: ctx.stranger.address,
      taxIdHash: partyIdHash("OTHER-CO"),
      name: "Other Co",
    });
    expectError(
      await send(ctx.svm, [ix], ctx.stranger),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("rejects a blank name", async () => {
    const { ctx } = await setupRegistry();
    const ix = await getRegisterBuyerInstructionAsync({
      admin: ctx.admin,
      buyerAuthority: ctx.stranger.address,
      taxIdHash: partyIdHash("OTHER-CO"),
      name: "  ",
    });
    expectError(
      await send(ctx.svm, [ix], ctx.admin),
      SELO_ERROR__INVALID_BUYER_NAME,
    );
  });

  it("keeps one wallet per company: the same tax ID cannot be registered again", async () => {
    const { ctx } = await setupRegistry();
    // Same company, typed differently, claimed by another wallet.
    const ix = await getRegisterBuyerInstructionAsync({
      admin: ctx.admin,
      buyerAuthority: ctx.stranger.address,
      taxIdHash: partyIdHash(" buyer.001 "),
      name: "Impostor",
    });
    expectFailure(await send(ctx.svm, [ix], ctx.admin));
  });
});

describe("attest_invoice with verified buyers", () => {
  it("rejects a wallet the registry has not verified", async () => {
    const { ctx } = await setupRegistry();
    // A supplier names its own accomplice as the buyer of a fake invoice.
    await sendOk(
      ctx.svm,
      [await sealIx(ctx, INVOICE, { buyer: ctx.stranger.address })],
      ctx.supplier,
    );
    expectError(
      await send(
        ctx.svm,
        [attestIx(ctx, await sealPdaOf(), ctx.stranger)],
        ctx.stranger,
      ),
      SELO_ERROR__BUYER_NOT_VERIFIED,
    );
  });

  it("rejects a revoked buyer", async () => {
    const { ctx } = await setupRegistry();
    await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
    await setBuyerActive(ctx, false);
    expectError(
      await send(ctx.svm, [attestIx(ctx, await sealPdaOf())], ctx.buyer),
      SELO_ERROR__BUYER_NOT_VERIFIED,
    );
  });
});

describe("lock_invoice with verified buyers", () => {
  it("rejects a lock when another verified company attested", async () => {
    const { ctx, treasury } = await setupRegistry();
    // The accomplice is a real, verified company, but not the one on the
    // invoice: it can attest, and the lender's lock catches the mismatch.
    const accompliceRecord = await registerBuyer(
      ctx,
      ctx.stranger.address,
      "OTHER-CO",
      "Other Co",
    );
    const seal = await sealPdaOf();
    await sendOk(
      ctx.svm,
      [await sealIx(ctx, INVOICE, { buyer: ctx.stranger.address })],
      ctx.supplier,
    );
    await sendOk(
      ctx.svm,
      [attestIx(ctx, seal, ctx.stranger, accompliceRecord)],
      ctx.stranger,
    );

    const check = await checkInvoice(svmRpc(ctx.svm), INVOICE);
    expect(check.buyer).toMatchObject({
      wallet: ctx.stranger.address,
      verification: "mismatch",
      name: "Buyer Co",
    });
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.lenderA)],
        ctx.lenderA,
      ),
      SELO_ERROR__BUYER_MISMATCH,
    );
    expect(fetchSeal(ctx.svm, seal).status).toBe(SealStatus.Sealed);
  });

  it("rejects a lock after the buyer's verification is revoked", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    await setBuyerActive(ctx, false);
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.lenderA)],
        ctx.lenderA,
      ),
      SELO_ERROR__BUYER_NOT_VERIFIED,
    );
    await setBuyerActive(ctx, true);
    await sendOk(
      ctx.svm,
      [await lockIx(ctx, treasury, seal, ctx.lenderA)],
      ctx.lenderA,
    );
  });

  it("rejects a buyer account that is not a registered Buyer", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    expectError(
      await send(
        ctx.svm,
        [
          await lockIx(ctx, treasury, seal, ctx.lenderA, {
            buyerRecord: seal,
          }),
        ],
        ctx.lenderA,
      ),
      AnchorErr.AccountDiscriminatorMismatch,
    );
  });
});

describe("checkInvoice buyer verification", () => {
  it("is verified for the company's own wallet", async () => {
    const { ctx } = await setupAttested();
    expect((await checkInvoice(svmRpc(ctx.svm), INVOICE)).buyer).toEqual({
      wallet: ctx.buyer.address,
      verification: "verified",
      name: "Buyer Co",
    });
  });

  it("is unknown from a bare hash", async () => {
    const { ctx, seal } = await setupAttested();
    const data = fetchSeal(ctx.svm, seal);
    const check = await checkInvoice(
      svmRpc(ctx.svm),
      new Uint8Array(data.invoiceHash),
    );
    expect(check.buyer?.verification).toBe("unknown");
  });

  it("is unverified when the company on the invoice is not registered", async () => {
    const { ctx } = await setupRegistry();
    const invoice = { ...INVOICE, buyerTaxId: "UNKNOWN-CO" };
    await sendOk(ctx.svm, [await sealIx(ctx, invoice)], ctx.supplier);
    expect(
      (await checkInvoice(svmRpc(ctx.svm), invoice)).buyer?.verification,
    ).toBe("unverified");
  });
});
