import { beforeEach, describe, expect, it } from "vitest";
import { getTransferSolInstruction } from "@solana-program/system";
import { lamports } from "@solana/kit";
import {
  DocType,
  SELO_ERROR__DOCUMENT_ALREADY_REGISTERED,
  SELO_ERROR__DOCUMENT_TYPE_ALREADY_ON_DEAL,
  SELO_ERROR__INVALID_DOCUMENT_TYPE,
  SELO_ERROR__INVALID_STATUS,
  decodeDocumentRecord,
  docHash,
  findDocRecordPda,
  parseDocumentRegisteredEvent,
} from "@selo/sdk";
import {
  AnchorErr,
  type Ctx,
  NOW,
  blHash,
  createDeal,
  eventsOf,
  expectError,
  fetchDeal,
  fundedDeal,
  registerIx,
  send,
  sendOk,
  setup,
} from "./helpers/selo";

describe("register_document", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("creates the record, links the B/L and emits DocumentRegistered", async () => {
    const { deal } = await fundedDeal(ctx);
    const hash = blHash();
    const res = await sendOk(
      ctx.svm,
      [await registerIx(ctx, deal, hash)],
      ctx.seller,
    );

    const [record] = await findDocRecordPda({ docHash: hash });
    const acc = decodeDocumentRecord(ctx.svm.getAccount(record));
    if (!acc.exists) throw new Error("record missing");
    expect(Uint8Array.from(acc.data.docHash)).toEqual(hash);
    expect(acc.data.docType).toBe(DocType.BillOfLading);
    expect(acc.data.deal).toBe(deal);
    expect(acc.data.registeredBy).toBe(ctx.seller.address);
    expect(acc.data.registeredAt).toBe(NOW);

    const d = fetchDeal(ctx.svm, deal);
    expect(d.billOfLading).toBe(record);
    expect(d.documents).toBe(1 << DocType.BillOfLading);
    expect(eventsOf(res, parseDocumentRegisteredEvent)[0].document).toBe(
      record,
    );
  });

  it("registers invoice and CPR alongside the B/L", async () => {
    const { deal } = await fundedDeal(ctx);
    const cnpj = "12.345.678/0001-90";
    const invoice = docHash({
      docType: DocType.CommercialInvoice,
      issuer: cnpj,
      number: "INV-7",
    });
    const cpr = docHash({
      docType: DocType.Cpr,
      issuer: cnpj,
      number: "CPR-7",
    });
    await sendOk(ctx.svm, [await registerIx(ctx, deal, blHash())], ctx.seller);
    await sendOk(
      ctx.svm,
      [await registerIx(ctx, deal, invoice, DocType.CommercialInvoice)],
      ctx.seller,
    );
    await sendOk(
      ctx.svm,
      [await registerIx(ctx, deal, cpr, DocType.Cpr)],
      ctx.seller,
    );
    expect(fetchDeal(ctx.svm, deal).documents).toBe(0b111);
  });

  it("blocks the same B/L on the same deal", async () => {
    const { deal } = await fundedDeal(ctx);
    await sendOk(ctx.svm, [await registerIx(ctx, deal, blHash())], ctx.seller);
    expectError(
      await send(ctx.svm, [await registerIx(ctx, deal, blHash())], ctx.seller),
      SELO_ERROR__DOCUMENT_ALREADY_REGISTERED,
    );
  });

  it("demo step 2: blocks the same B/L on a second deal with another financier", async () => {
    const first = await fundedDeal(ctx);
    await sendOk(
      ctx.svm,
      [await registerIx(ctx, first.deal, blHash("MAEU-123 456"))],
      ctx.seller,
    );

    const second = await fundedDeal(ctx);
    // Differently formatted, same canonical document.
    const res = await send(
      ctx.svm,
      [await registerIx(ctx, second.deal, blHash("maeu123456"))],
      ctx.seller,
    );
    expectError(res, SELO_ERROR__DOCUMENT_ALREADY_REGISTERED);
    expect(fetchDeal(ctx.svm, second.deal).documents).toBe(0);
  });

  it("still registers when someone pre-funded the record PDA (griefing)", async () => {
    const { deal } = await fundedDeal(ctx);
    const hash = blHash();
    const [record] = await findDocRecordPda({ docHash: hash });
    await sendOk(
      ctx.svm,
      [
        getTransferSolInstruction({
          source: ctx.stranger,
          destination: record,
          amount: lamports(1_000_000n),
        }),
      ],
      ctx.stranger,
    );
    await sendOk(ctx.svm, [await registerIx(ctx, deal, hash)], ctx.seller);
    expect(fetchDeal(ctx.svm, deal).billOfLading).toBe(record);
  });

  it("rejects registration before funding", async () => {
    const { deal } = await createDeal(ctx);
    expectError(
      await send(ctx.svm, [await registerIx(ctx, deal, blHash())], ctx.seller),
      SELO_ERROR__INVALID_STATUS,
    );
  });

  it("rejects a signer that is not the seller", async () => {
    const { deal } = await fundedDeal(ctx);
    const ix = await registerIx(
      ctx,
      deal,
      blHash(),
      DocType.BillOfLading,
      ctx.stranger,
    );
    // Deal PDA seeds use deal.seller, so the has_one check is what fails.
    expectError(
      await send(ctx.svm, [ix], ctx.stranger),
      AnchorErr.ConstraintHasOne,
    );
  });

  it("rejects a second document of the same type on a deal", async () => {
    const { deal } = await fundedDeal(ctx);
    await sendOk(ctx.svm, [await registerIx(ctx, deal, blHash())], ctx.seller);
    expectError(
      await send(
        ctx.svm,
        [await registerIx(ctx, deal, blHash("MAEU-999"))],
        ctx.seller,
      ),
      SELO_ERROR__DOCUMENT_TYPE_ALREADY_ON_DEAL,
    );
  });

  it("rejects an unknown document type", async () => {
    const { deal } = await fundedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await registerIx(ctx, deal, blHash(), 3)],
        ctx.seller,
      ),
      SELO_ERROR__INVALID_DOCUMENT_TYPE,
    );
  });
});
