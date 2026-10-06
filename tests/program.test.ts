import { describe, expect, it } from "vitest";
import { assertAccountExists } from "@solana/kit";
import { decodeMint } from "@solana-program/token";
import { SELO_PROGRAM_ADDRESS, USDC_DECIMALS } from "@selo/sdk";
import { USDC, mintTo, setup, tokenBalance } from "./helpers/selo";

describe("program skeleton", () => {
  it("loads the program as executable", async () => {
    const { svm } = await setup();
    const program = svm.getAccount(SELO_PROGRAM_ADDRESS);
    assertAccountExists(program);
    expect(program.executable).toBe(true);
  });

  it("creates a 6-decimal fee mint and funds lenders", async () => {
    const ctx = await setup();
    const mint = decodeMint(ctx.svm.getAccount(ctx.feeMint));
    assertAccountExists(mint);
    expect(mint.data.decimals).toBe(USDC_DECIMALS);

    const token = await mintTo(ctx, ctx.lenderA.address, 100n * USDC);
    expect(tokenBalance(ctx.svm, token)).toBe(100n * USDC);
  });
});
