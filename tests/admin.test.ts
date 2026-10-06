import { describe, expect, it } from "vitest";
import {
  SELO_ERROR__INVALID_FEE_MINT,
  SELO_ERROR__INVALID_LENDER_NAME,
  SELO_ERROR__LOCK_FEE_TOO_HIGH,
  SELO_ERROR__NOT_UPGRADE_AUTHORITY,
  SELO_PROGRAM_ADDRESS,
  findProgramDataAddress,
  getInitializeInstructionAsync,
  getRegisterLenderInstructionAsync,
  getSetLenderActiveInstructionAsync,
  getSetPausedInstructionAsync,
} from "@selo/sdk";
import {
  AnchorErr,
  type Ctx,
  LOCK_FEE,
  USDC,
  createMint,
  expectError,
  expectFailure,
  fetchConfig,
  fetchLender,
  initRegistry,
  mintTo,
  registerLender,
  send,
  sendOk,
  setup,
  setupRegistry,
} from "./helpers/selo";

async function initIx(
  ctx: Ctx,
  over: Partial<{
    admin: Ctx["admin"];
    feeMint: Ctx["feeMint"];
    treasury: Ctx["feeMint"];
    lockFee: bigint;
  }> = {},
) {
  return getInitializeInstructionAsync({
    admin: over.admin ?? ctx.admin,
    feeMint: over.feeMint ?? ctx.feeMint,
    treasury: over.treasury ?? (await mintTo(ctx, ctx.admin.address, 0n)),
    program: SELO_PROGRAM_ADDRESS,
    programData: await findProgramDataAddress(),
    lockFee: over.lockFee ?? LOCK_FEE,
  });
}

describe("initialize", () => {
  it("stores admin, treasury, fee mint and fee, unpaused", async () => {
    const ctx = await setup();
    const { treasury } = await initRegistry(ctx);
    const config = await fetchConfig(ctx.svm);
    expect(config.admin).toBe(ctx.admin.address);
    expect(config.treasury).toBe(treasury);
    expect(config.feeMint).toBe(ctx.feeMint);
    expect(config.lockFee).toBe(LOCK_FEE);
    expect(config.paused).toBe(false);
  });

  it("rejects a signer that is not the upgrade authority", async () => {
    const ctx = await setup();
    const ix = await initIx(ctx, { admin: ctx.stranger });
    expectError(
      await send(ctx.svm, [ix], ctx.stranger),
      SELO_ERROR__NOT_UPGRADE_AUTHORITY,
    );
  });

  it("rejects a lock fee above the maximum", async () => {
    const ctx = await setup();
    const ix = await initIx(ctx, { lockFee: 100n * USDC + 1n });
    expectError(
      await send(ctx.svm, [ix], ctx.admin),
      SELO_ERROR__LOCK_FEE_TOO_HIGH,
    );
  });

  it("rejects a fee mint without 6 decimals", async () => {
    const ctx = await setup();
    const nineDecimals = await createMint(ctx.svm, ctx.faucet, 9);
    const treasury = await mintTo(ctx, ctx.admin.address, 0n, nineDecimals);
    const ix = await initIx(ctx, { feeMint: nineDecimals, treasury });
    expectError(
      await send(ctx.svm, [ix], ctx.admin),
      SELO_ERROR__INVALID_FEE_MINT,
    );
  });

  it("rejects a treasury of another mint", async () => {
    const ctx = await setup();
    const treasury = await mintTo(ctx, ctx.admin.address, 0n, ctx.otherMint);
    const ix = await initIx(ctx, { treasury });
    expectError(
      await send(ctx.svm, [ix], ctx.admin),
      AnchorErr.ConstraintTokenMint,
    );
  });

  it("cannot run twice", async () => {
    const ctx = await setup();
    await initRegistry(ctx);
    expectFailure(await send(ctx.svm, [await initIx(ctx)], ctx.admin));
  });
});

describe("register_lender", () => {
  it("registers an active lender with its name", async () => {
    const { ctx, lenderA } = await setupRegistry();
    const lender = fetchLender(ctx.svm, lenderA);
    expect(lender.authority).toBe(ctx.lenderA.address);
    expect(lender.name).toBe("Lender A");
    expect(lender.active).toBe(true);
    expect(lender.locksCount).toBe(0n);
  });

  it("accepts a 32-byte name", async () => {
    const ctx = await setup();
    await initRegistry(ctx);
    const name = "x".repeat(32);
    const lender = await registerLender(ctx, ctx.lenderA.address, name);
    expect(fetchLender(ctx.svm, lender).name).toBe(name);
  });

  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["33 bytes", "x".repeat(33)],
  ])("rejects a %s name", async (_, name) => {
    const ctx = await setup();
    await initRegistry(ctx);
    const ix = await getRegisterLenderInstructionAsync({
      admin: ctx.admin,
      lenderAuthority: ctx.lenderA.address,
      name,
    });
    expectError(
      await send(ctx.svm, [ix], ctx.admin),
      SELO_ERROR__INVALID_LENDER_NAME,
    );
  });

  it("rejects a non-admin signer", async () => {
    const ctx = await setup();
    await initRegistry(ctx);
    const ix = await getRegisterLenderInstructionAsync({
      admin: ctx.stranger,
      lenderAuthority: ctx.stranger.address,
      name: "Rogue",
    });
    expectError(
      await send(ctx.svm, [ix], ctx.stranger),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("cannot register the same lender twice", async () => {
    const { ctx } = await setupRegistry();
    const ix = await getRegisterLenderInstructionAsync({
      admin: ctx.admin,
      lenderAuthority: ctx.lenderA.address,
      name: "Lender A again",
    });
    expectFailure(await send(ctx.svm, [ix], ctx.admin));
  });
});

describe("set_lender_active", () => {
  it("lets the admin deactivate and reactivate a lender", async () => {
    const { ctx, lenderA } = await setupRegistry();
    for (const active of [false, true]) {
      await sendOk(
        ctx.svm,
        [
          await getSetLenderActiveInstructionAsync({
            admin: ctx.admin,
            lender: lenderA,
            active,
          }),
        ],
        ctx.admin,
      );
      expect(fetchLender(ctx.svm, lenderA).active).toBe(active);
    }
  });

  it("rejects a non-admin signer", async () => {
    const { ctx, lenderB } = await setupRegistry();
    const ix = await getSetLenderActiveInstructionAsync({
      admin: ctx.lenderA,
      lender: lenderB,
      active: false,
    });
    expectError(
      await send(ctx.svm, [ix], ctx.lenderA),
      AnchorErr.ConstraintHasOne,
    );
  });
});

describe("set_paused", () => {
  it("lets the admin pause and unpause", async () => {
    const { ctx } = await setupRegistry();
    for (const paused of [true, false]) {
      await sendOk(
        ctx.svm,
        [await getSetPausedInstructionAsync({ admin: ctx.admin, paused })],
        ctx.admin,
      );
      expect((await fetchConfig(ctx.svm)).paused).toBe(paused);
    }
  });

  it("rejects a non-admin signer", async () => {
    const { ctx } = await setupRegistry();
    const ix = await getSetPausedInstructionAsync({
      admin: ctx.stranger,
      paused: true,
    });
    expectError(
      await send(ctx.svm, [ix], ctx.stranger),
      AnchorErr.ConstraintHasOne,
    );
  });
});
