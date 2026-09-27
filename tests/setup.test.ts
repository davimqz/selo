import { expect } from "chai";
import {
  SELO_PROGRAM_ID,
  USDC,
  USDC_DECIMALS,
  createMockUsdc,
  fundedKeypair,
  mintInfo,
  mintUsdc,
  startSvm,
  tokenBalance,
} from "./helpers/svm";

// Phase 0 smoke tests: toolchain, program artifact and mock USDC wiring.
describe("setup", () => {
  it("loads the Selo program as an executable account", () => {
    const svm = startSvm();
    const program = svm.getAccount(SELO_PROGRAM_ID);
    expect(program, "program account").to.not.equal(null);
    expect(program!.executable).to.equal(true);
  });

  it("creates a 6-decimal mock USDC mint and funds a buyer", () => {
    const svm = startSvm();
    const faucet = fundedKeypair(svm);
    const buyer = fundedKeypair(svm);

    const mint = createMockUsdc(svm, faucet);
    const ata = mintUsdc(svm, mint, faucet, buyer.publicKey, 250_000n * USDC);

    const info = mintInfo(svm, mint);
    expect(info.decimals).to.equal(USDC_DECIMALS);
    expect(info.mintAuthority?.toBase58()).to.equal(
      faucet.publicKey.toBase58(),
    );
    expect(tokenBalance(svm, ata)).to.equal(250_000n * USDC);
  });
});
