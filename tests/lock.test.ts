import { describe, expect, it } from "vitest";
import {
  SELO_ERROR__ALREADY_ATTESTED,
  SELO_ERROR__INVALID_STATUS,
  SELO_ERROR__INVOICE_ALREADY_LOCKED,
  SELO_ERROR__LENDER_INACTIVE,
  SELO_ERROR__NOT_ATTESTED,
  SELO_ERROR__NOT_LOCK_HOLDER,
  SELO_ERROR__PAUSED,
  SealStatus,
  checkInvoice,
  describeSeloError,
  getCancelSealInstruction,
  getSetLenderActiveInstructionAsync,
  getSetPausedInstructionAsync,
  parseInvoiceAttestedEvent,
  parseInvoiceLockedEvent,
  parseInvoiceReleasedEvent,
} from "@selo/sdk";
import {
  AnchorErr,
  INVOICE,
  LENDER_BALANCE,
  LOCK_FEE,
  NOW,
  attestIx,
  eventsOf,
  expectError,
  expectFailure,
  fetchLender,
  fetchSeal,
  lockIx,
  logsOf,
  mintTo,
  releaseIx,
  sealIx,
  sealPdaOf,
  send,
  sendOk,
  setTime,
  setupAttested,
  setupRegistry,
  svmRpc,
  tokenBalance,
} from "./helpers/selo";

describe("attest_invoice", () => {
  async function sealed() {
    const reg = await setupRegistry();
    await sendOk(reg.ctx.svm, [await sealIx(reg.ctx)], reg.ctx.supplier);
    return { ...reg, seal: await sealPdaOf() };
  }

  it("lets the buyer attest a sealed invoice", async () => {
    const { ctx, seal } = await sealed();
    const res = await sendOk(ctx.svm, [attestIx(ctx, seal)], ctx.buyer);
    const data = fetchSeal(ctx.svm, seal);
    expect(data.buyerAttested).toBe(true);
    expect(data.status).toBe(SealStatus.Sealed);
    const [event] = eventsOf(res, parseInvoiceAttestedEvent);
    expect(event.buyer).toBe(ctx.buyer.address);
  });

  it.each(["supplier", "stranger", "lenderA"] as const)(
    "rejects the %s",
    async (who) => {
      const { ctx, seal } = await sealed();
      expectError(
        await send(ctx.svm, [attestIx(ctx, seal, ctx[who])], ctx[who]),
        AnchorErr.ConstraintHasOne,
      );
    },
  );

  it("cannot attest twice", async () => {
    const { ctx, seal } = await sealed();
    await sendOk(ctx.svm, [attestIx(ctx, seal)], ctx.buyer);
    expectError(
      await send(ctx.svm, [attestIx(ctx, seal)], ctx.buyer),
      SELO_ERROR__ALREADY_ATTESTED,
    );
  });

  it("cannot attest a cancelled invoice", async () => {
    const { ctx, seal } = await sealed();
    await sendOk(
      ctx.svm,
      [getCancelSealInstruction({ supplier: ctx.supplier, seal })],
      ctx.supplier,
    );
    expectError(
      await send(ctx.svm, [attestIx(ctx, seal)], ctx.buyer),
      SELO_ERROR__INVALID_STATUS,
    );
  });
});

describe("lock_invoice", () => {
  it("locks for the lender and charges the exact fee to the treasury", async () => {
    const { ctx, treasury, lenderA, seal } = await setupAttested();
    setTime(ctx.svm, NOW + 60n);
    const res = await sendOk(
      ctx.svm,
      [await lockIx(ctx, treasury, seal, ctx.lenderA)],
      ctx.lenderA,
    );

    const data = fetchSeal(ctx.svm, seal);
    expect(data.status).toBe(SealStatus.Locked);
    expect(data.lender).toBe(ctx.lenderA.address);
    expect(data.lockedAt).toBe(NOW + 60n);
    expect(fetchLender(ctx.svm, lenderA).locksCount).toBe(1n);

    // CLAUDE.md section 11, test 6.
    expect(tokenBalance(ctx.svm, treasury)).toBe(LOCK_FEE);
    expect(tokenBalance(ctx.svm, await ctx.ata(ctx.lenderA.address))).toBe(
      LENDER_BALANCE - LOCK_FEE,
    );

    const [event] = eventsOf(res, parseInvoiceLockedEvent);
    expect(event.lender).toBe(ctx.lenderA.address);
    expect(event.fee).toBe(LOCK_FEE);
  });

  // CLAUDE.md section 11, test 2.
  it("rejects lender B on an invoice locked by A, with a translatable error", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    await sendOk(
      ctx.svm,
      [await lockIx(ctx, treasury, seal, ctx.lenderA)],
      ctx.lenderA,
    );
    const res = await send(
      ctx.svm,
      [await lockIx(ctx, treasury, seal, ctx.lenderB)],
      ctx.lenderB,
    );
    expectError(res, SELO_ERROR__INVOICE_ALREADY_LOCKED);
    expect(logsOf(res).join("\n")).toContain(
      `Locked by ${ctx.lenderA.address} at ${NOW}`,
    );

    const check = await checkInvoice(svmRpc(ctx.svm), INVOICE);
    expect(
      describeSeloError(SELO_ERROR__INVOICE_ALREADY_LOCKED, {
        lenderName: check.lender?.name,
        lockedAt: check.lockedAt,
      }),
    ).toBe(
      "Already financed by Lender A on 15 Jan 2027. It cannot be financed twice.",
    );
    // B paid nothing.
    expect(tokenBalance(ctx.svm, await ctx.ata(ctx.lenderB.address))).toBe(
      LENDER_BALANCE,
    );
  });

  it("rejects lender A locking its own lock again", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    const lock = async () =>
      send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.lenderA)],
        ctx.lenderA,
      );
    await lock();
    expectError(await lock(), SELO_ERROR__INVOICE_ALREADY_LOCKED);
  });

  // CLAUDE.md section 11, test 3.
  it("rejects an invoice the buyer has not attested", async () => {
    const { ctx, treasury } = await setupRegistry();
    await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, await sealPdaOf(), ctx.lenderA)],
        ctx.lenderA,
      ),
      SELO_ERROR__NOT_ATTESTED,
    );
  });

  // CLAUDE.md section 11, test 7.
  it("rejects an inactive lender", async () => {
    const { ctx, treasury, lenderA, seal } = await setupAttested();
    await sendOk(
      ctx.svm,
      [
        await getSetLenderActiveInstructionAsync({
          admin: ctx.admin,
          lender: lenderA,
          active: false,
        }),
      ],
      ctx.admin,
    );
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.lenderA)],
        ctx.lenderA,
      ),
      SELO_ERROR__LENDER_INACTIVE,
    );
  });

  it("is blocked while paused", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    await sendOk(
      ctx.svm,
      [await getSetPausedInstructionAsync({ admin: ctx.admin, paused: true })],
      ctx.admin,
    );
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.lenderA)],
        ctx.lenderA,
      ),
      SELO_ERROR__PAUSED,
    );
  });

  // CLAUDE.md section 11, test 4 (wrong signer / swapped accounts).
  it("rejects an unregistered wallet", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.stranger)],
        ctx.stranger,
      ),
      AnchorErr.AccountNotInitialized,
    );
  });

  it("rejects a signer using another lender's account", async () => {
    const { ctx, treasury, lenderA, seal } = await setupAttested();
    const ix = await lockIx(ctx, treasury, seal, ctx.stranger, {
      lender: lenderA,
    });
    expectError(
      await send(ctx.svm, [ix], ctx.stranger),
      AnchorErr.ConstraintSeeds,
    );
  });

  it("rejects a treasury other than the config's", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    const ix = await lockIx(ctx, treasury, seal, ctx.lenderA, {
      treasury: await ctx.ata(ctx.lenderB.address),
    });
    expectError(
      await send(ctx.svm, [ix], ctx.lenderA),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("rejects paying the fee in another mint", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    await mintTo(ctx, ctx.lenderA.address, LENDER_BALANCE, ctx.otherMint);
    const ix = await lockIx(ctx, treasury, seal, ctx.lenderA, {
      feeMint: ctx.otherMint,
    });
    expectError(
      await send(ctx.svm, [ix], ctx.lenderA),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("rejects paying from someone else's token account", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    const ix = await lockIx(ctx, treasury, seal, ctx.lenderA, {
      lenderToken: await ctx.ata(ctx.lenderB.address),
    });
    expectError(
      await send(ctx.svm, [ix], ctx.lenderA),
      AnchorErr.ConstraintTokenOwner,
    );
  });

  it("fails without enough USDC-dev for the fee", async () => {
    const { ctx, treasury, seal } = await setupAttested();
    // Zero lender B's balance (SPL token account: amount is bytes 64..72).
    const token = await ctx.ata(ctx.lenderB.address);
    const acc = ctx.svm.getAccount(token);
    if (!acc.exists) throw new Error("missing token account");
    const data = new Uint8Array(acc.data);
    data.fill(0, 64, 72);
    ctx.svm.setAccount({ ...acc, data });
    const res = await send(
      ctx.svm,
      [await lockIx(ctx, treasury, seal, ctx.lenderB)],
      ctx.lenderB,
    );
    expectFailure(res);
    expect(logsOf(res).join("\n")).toContain("insufficient funds");
    expect(fetchSeal(ctx.svm, seal).status).toBe(SealStatus.Sealed);
  });

  it("rejects a cancelled invoice", async () => {
    const { ctx, treasury } = await setupRegistry();
    const seal = await sealPdaOf();
    await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
    await sendOk(ctx.svm, [attestIx(ctx, seal)], ctx.buyer);
    await sendOk(
      ctx.svm,
      [getCancelSealInstruction({ supplier: ctx.supplier, seal })],
      ctx.supplier,
    );
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.lenderA)],
        ctx.lenderA,
      ),
      SELO_ERROR__INVALID_STATUS,
    );
  });
});

describe("release_invoice", () => {
  async function locked() {
    const reg = await setupAttested();
    await sendOk(
      reg.ctx.svm,
      [await lockIx(reg.ctx, reg.treasury, reg.seal, reg.ctx.lenderA)],
      reg.ctx.lenderA,
    );
    return reg;
  }

  it("lets the locking lender mark the invoice released", async () => {
    const { ctx, seal } = await locked();
    const res = await sendOk(
      ctx.svm,
      [releaseIx(seal, ctx.lenderA)],
      ctx.lenderA,
    );
    expect(fetchSeal(ctx.svm, seal).status).toBe(SealStatus.Released);
    const [event] = eventsOf(res, parseInvoiceReleasedEvent);
    expect(event.lender).toBe(ctx.lenderA.address);
  });

  // CLAUDE.md section 11, test 5.
  it.each(["lenderB", "supplier", "buyer", "admin"] as const)(
    "rejects the %s",
    async (who) => {
      const { ctx, seal } = await locked();
      expectError(
        await send(ctx.svm, [releaseIx(seal, ctx[who])], ctx[who]),
        SELO_ERROR__NOT_LOCK_HOLDER,
      );
    },
  );

  it("cannot release an invoice that was never locked", async () => {
    const { ctx, seal } = await setupAttested();
    expectError(
      await send(ctx.svm, [releaseIx(seal, ctx.lenderA)], ctx.lenderA),
      SELO_ERROR__NOT_LOCK_HOLDER,
    );
  });

  it("cannot release twice, and a released invoice cannot be locked", async () => {
    const { ctx, treasury, seal } = await locked();
    await sendOk(ctx.svm, [releaseIx(seal, ctx.lenderA)], ctx.lenderA);
    expectError(
      await send(ctx.svm, [releaseIx(seal, ctx.lenderA)], ctx.lenderA),
      SELO_ERROR__INVALID_STATUS,
    );
    expectError(
      await send(
        ctx.svm,
        [await lockIx(ctx, treasury, seal, ctx.lenderB)],
        ctx.lenderB,
      ),
      SELO_ERROR__INVALID_STATUS,
    );
  });
});
