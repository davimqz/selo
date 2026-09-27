import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_REQUIRED_MILESTONES,
  Milestone,
  SELO_ERROR__INVALID_MILESTONE,
  SELO_ERROR__INVALID_STATUS,
  SELO_ERROR__MILESTONE_NOT_REQUIRED,
  SELO_ERROR__SHIPMENT_DEADLINE_PASSED,
  SELO_ERROR__UNAUTHORIZED_ATTESTER,
  decodeMilestoneRecord,
  findMilestonePda,
  parseMilestoneAttestedEvent,
} from "@selo/sdk";
import {
  type Ctx,
  EVIDENCE,
  NOW,
  attest,
  attestIx,
  createDeal,
  eventsOf,
  expectError,
  expectAlreadyInUse,
  fetchDeal,
  fundedDeal,
  send,
  setTime,
  setup,
} from "./helpers/selo";

const WITH_DELIVERED = DEFAULT_REQUIRED_MILESTONES | Milestone.DELIVERED;

describe("attest_milestone", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("records an allowlisted attestation and emits MilestoneAttested", async () => {
    const { deal } = await fundedDeal(ctx);
    const res = await attest(ctx, deal, ctx.inspector, Milestone.SHIPPED);

    const record = decodeMilestoneRecord(
      ctx.svm.getAccount(await findMilestonePda(deal, Milestone.SHIPPED)),
    );
    if (!record.exists) throw new Error("record missing");
    expect(record.data.attester).toBe(ctx.inspector.address);
    expect(record.data.milestone).toBe(Milestone.SHIPPED);
    expect(Uint8Array.from(record.data.evidenceHash)).toEqual(EVIDENCE);
    expect(record.data.attestedAt).toBe(NOW);
    expect(fetchDeal(ctx.svm, deal).attestedMilestones).toBe(Milestone.SHIPPED);

    const [event] = eventsOf(res, parseMilestoneAttestedEvent);
    expect(event.attester).toBe(ctx.inspector.address);
  });

  it("lets the destination surveyor attest DELIVERED", async () => {
    const { deal } = await fundedDeal(ctx, {
      requiredMilestones: WITH_DELIVERED,
    });
    await attest(ctx, deal, ctx.surveyor, Milestone.DELIVERED);
    expect(fetchDeal(ctx.svm, deal).attestedMilestones).toBe(
      Milestone.DELIVERED,
    );
  });

  it("lets the buyer attest DELIVERED without being allowlisted", async () => {
    const { deal } = await fundedDeal(ctx, {
      requiredMilestones: WITH_DELIVERED,
    });
    await attest(ctx, deal, ctx.buyer, Milestone.DELIVERED);
  });

  it("rejects a signer outside the allowlist", async () => {
    const { deal } = await fundedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.stranger, Milestone.SHIPPED)],
        ctx.stranger,
      ),
      SELO_ERROR__UNAUTHORIZED_ATTESTER,
    );
  });

  it("rejects an attester without that milestone bit", async () => {
    const { deal } = await fundedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.eudr, Milestone.SHIPPED)],
        ctx.eudr,
      ),
      SELO_ERROR__UNAUTHORIZED_ATTESTER,
    );
  });

  it("rejects the buyer attesting SHIPPED", async () => {
    const { deal } = await fundedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.buyer, Milestone.SHIPPED)],
        ctx.buyer,
      ),
      SELO_ERROR__UNAUTHORIZED_ATTESTER,
    );
  });

  it("rejects the seller attesting", async () => {
    const { deal } = await fundedDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.seller, Milestone.SHIPPED)],
        ctx.seller,
      ),
      SELO_ERROR__UNAUTHORIZED_ATTESTER,
    );
  });

  it("rejects a milestone the deal does not require", async () => {
    const { deal } = await fundedDeal(ctx); // DELIVERED not required
    expectError(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.surveyor, Milestone.DELIVERED)],
        ctx.surveyor,
      ),
      SELO_ERROR__MILESTONE_NOT_REQUIRED,
    );
  });

  it("rejects multi-bit or unknown milestone values", async () => {
    const { deal } = await fundedDeal(ctx);
    for (const value of [Milestone.INSPECTED | Milestone.SHIPPED, 0, 0x10]) {
      expectError(
        await send(
          ctx.svm,
          [await attestIx(deal, ctx.inspector, value)],
          ctx.inspector,
        ),
        SELO_ERROR__INVALID_MILESTONE,
      );
    }
  });

  it("cannot attest the same milestone twice", async () => {
    const { deal } = await fundedDeal(ctx);
    await attest(ctx, deal, ctx.inspector, Milestone.SHIPPED);
    expectAlreadyInUse(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.inspector, Milestone.SHIPPED)],
        ctx.inspector,
      ),
    );
  });

  it("rejects attestation on an unfunded deal", async () => {
    const { deal } = await createDeal(ctx);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.inspector, Milestone.SHIPPED)],
        ctx.inspector,
      ),
      SELO_ERROR__INVALID_STATUS,
    );
  });

  it("rejects SHIPPED after the latest shipment date", async () => {
    const { deal, terms } = await fundedDeal(ctx);
    setTime(ctx.svm, terms.expiresAt + 1n);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(deal, ctx.inspector, Milestone.SHIPPED)],
        ctx.inspector,
      ),
      SELO_ERROR__SHIPMENT_DEADLINE_PASSED,
    );
  });

  it("accepts SHIPPED exactly at the latest shipment date", async () => {
    const { deal, terms } = await fundedDeal(ctx);
    setTime(ctx.svm, terms.expiresAt);
    await attest(ctx, deal, ctx.inspector, Milestone.SHIPPED);
  });

  it("after expiry, accepts other milestones only for shipped deals", async () => {
    const unshipped = await fundedDeal(ctx);
    const shipped = await fundedDeal(ctx);
    await attest(ctx, shipped.deal, ctx.inspector, Milestone.SHIPPED);

    setTime(ctx.svm, unshipped.terms.expiresAt + 1n);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(unshipped.deal, ctx.eudr, Milestone.EUDR_COMPLIANT)],
        ctx.eudr,
      ),
      SELO_ERROR__SHIPMENT_DEADLINE_PASSED,
    );
    await attest(ctx, shipped.deal, ctx.eudr, Milestone.EUDR_COMPLIANT);
  });

  it("does not let an attester of one deal attest another", async () => {
    const a = await fundedDeal(ctx);
    const b = await fundedDeal(ctx, {
      attesters: [{ key: ctx.surveyor.address, milestones: Milestone.SHIPPED }],
    });
    await attest(ctx, a.deal, ctx.inspector, Milestone.SHIPPED);
    expectError(
      await send(
        ctx.svm,
        [await attestIx(b.deal, ctx.inspector, Milestone.SHIPPED)],
        ctx.inspector,
      ),
      SELO_ERROR__UNAUTHORIZED_ATTESTER,
    );
  });
});
