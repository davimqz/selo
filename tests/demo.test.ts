/**
 * The five demo moments (CLAUDE.md section 2), end to end through the SDK the
 * app uses: checkInvoice() before each step and explainError() on rejections.
 */
import { describe, expect, it } from "vitest";
import {
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  SolanaError,
} from "@solana/kit";
import { type Invoice, checkInvoice, explainError } from "@selo/sdk";
import {
  INVOICE,
  attestIx,
  expectFailure,
  lockIx,
  logsOf,
  sealIx,
  sealPdaOf,
  send,
  sendOk,
  setupRegistry,
  svmRpc,
} from "./helpers/selo";

/** What a wallet / RPC send would throw for a failed LiteSVM transaction. */
function asKitError(res: Awaited<ReturnType<typeof send>>): Error {
  const m = logsOf(res)
    .join("\n")
    .match(/Error Number: (\d+)\./);
  if (!m) throw new Error("transaction did not fail with a program error");
  return new Error("Transaction simulation failed", {
    cause: new SolanaError(SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM, {
      code: Number(m[1]),
      index: 0,
    }),
  });
}

describe("demo: the same invoice cannot be financed twice", () => {
  it("runs the five moments", async () => {
    const { ctx, treasury } = await setupRegistry();
    const rpc = svmRpc(ctx.svm);
    const seal = await sealPdaOf();

    // 1. The supplier seals an invoice: only the hash goes on-chain.
    expect((await checkInvoice(rpc, INVOICE)).status).toBe("free");
    await sendOk(ctx.svm, [await sealIx(ctx)], ctx.supplier);
    expect(await checkInvoice(rpc, INVOICE)).toMatchObject({
      status: "sealed",
      attested: false,
      terms: { faceAmount: 1_250_000n, currency: "USD" },
    });

    // 2. The buyer attests the invoice is real and due.
    await sendOk(ctx.svm, [attestIx(ctx, seal)], ctx.buyer);
    expect((await checkInvoice(rpc, INVOICE)).attested).toBe(true);

    // 3. Lender A checks, sees it is not financed, and locks it.
    const beforeA = await checkInvoice(rpc, INVOICE);
    expect(beforeA.status).toBe("sealed");
    expect(beforeA.lender).toBeUndefined();
    await sendOk(
      ctx.svm,
      [await lockIx(ctx, treasury, seal, ctx.lenderA)],
      ctx.lenderA,
    );

    // 4. Lender B tries to lock the same invoice and is rejected, seeing who
    //    financed it and when.
    const beforeB = await checkInvoice(rpc, INVOICE);
    expect(beforeB.status).toBe("locked");
    expect(beforeB.lender?.name).toBe("Lender A");
    const lockB = await send(
      ctx.svm,
      [await lockIx(ctx, treasury, seal, ctx.lenderB)],
      ctx.lenderB,
    );
    expectFailure(lockB);
    expect(
      await explainError(asKitError(lockB), { rpc, invoice: INVOICE }),
    ).toBe(
      "Already financed by Lender A on 15 Jan 2027. It cannot be financed twice.",
    );

    // 5. Someone seals the same invoice typed differently and is rejected.
    const retyped: Invoice = {
      buyerTaxId: "buyer 001",
      supplierTaxId: "sup-042",
      number: " inv-2026-0001 ",
      amount: "1250000",
      currency: "usd",
      dueDate: "2027-04-15",
    };
    const resealed = await send(
      ctx.svm,
      [await sealIx(ctx, retyped, { supplier: ctx.stranger })],
      ctx.stranger,
    );
    expectFailure(resealed);
    expect(await explainError(asKitError(resealed))).toBe(
      "This invoice is already registered in Selo. It cannot be registered twice.",
    );
    expect((await checkInvoice(rpc, retyped)).status).toBe("locked");
  });
});
