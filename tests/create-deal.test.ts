import { beforeEach, describe, expect, it } from "vitest";
import {
  DealStatus,
  Milestone,
  SELO_ERROR__INVALID_AMOUNT,
  SELO_ERROR__INVALID_ATTESTERS,
  SELO_ERROR__INVALID_BPS,
  SELO_ERROR__INVALID_MILESTONE,
  SELO_ERROR__INVALID_PARTIES,
  SELO_ERROR__INVALID_SCHEDULE,
  SELO_ERROR__SHIPPED_NOT_REQUIRED,
  parseDealCreatedEvent,
} from "@selo/sdk";
import {
  AMOUNT,
  type Ctx,
  DAY,
  NOW,
  createDeal,
  createDealIx,
  eventsOf,
  expectError,
  fetchDeal,
  send,
  setup,
} from "./helpers/selo";

describe("create_deal", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  async function expectCreateError(
    overrides: Parameters<typeof createDealIx>[1],
    code: number,
  ) {
    const { ix } = await createDealIx(ctx, overrides);
    expectError(await send(ctx.svm, [ix], ctx.seller), code);
  }

  it("stores the terms and emits DealCreated", async () => {
    const { deal, terms, res } = await createDeal(ctx);
    const d = fetchDeal(ctx.svm, deal);

    expect(d.seller).toBe(ctx.seller.address);
    expect(d.buyer).toBe(ctx.buyer.address);
    expect(d.usdcMint).toBe(ctx.mint);
    expect(d.amount).toBe(AMOUNT);
    expect(d.requiredMilestones).toBe(terms.requiredMilestones);
    expect(d.attestedMilestones).toBe(0);
    expect(d.status).toBe(DealStatus.Created);
    expect(d.createdAt).toBe(NOW);
    expect(d.expiresAt).toBe(terms.expiresAt);
    expect(d.paymentDueAt).toBe(terms.paymentDueAt);
    expect(d.attesters[0].key).toBe(ctx.inspector.address);
    expect(d.attesters[3].milestones).toBe(0);

    const [event] = eventsOf(res, parseDealCreatedEvent);
    expect(event.deal).toBe(deal);
    expect(event.amount).toBe(AMOUNT);
  });

  it("accepts expires_at == payment_due_at", async () => {
    await createDeal(ctx, {
      expiresAt: NOW + DAY,
      paymentDueAt: NOW + DAY,
    });
  });

  it("rejects a zero amount", async () => {
    await expectCreateError({ amount: 0n }, SELO_ERROR__INVALID_AMOUNT);
  });

  it("rejects an advance cap + fee that could exceed the escrow", async () => {
    // 9_900 * (10_000 + 200) > 10_000²
    await expectCreateError(
      { maxAdvanceBps: 9_900, advanceFeeBps: 200 },
      SELO_ERROR__INVALID_BPS,
    );
  });

  it("rejects expires_at <= now", async () => {
    await expectCreateError({ expiresAt: NOW }, SELO_ERROR__INVALID_SCHEDULE);
  });

  it("rejects expires_at > payment_due_at", async () => {
    await expectCreateError(
      { expiresAt: NOW + 10n * DAY, paymentDueAt: NOW + 9n * DAY },
      SELO_ERROR__INVALID_SCHEDULE,
    );
  });

  it("requires SHIPPED", async () => {
    await expectCreateError(
      { requiredMilestones: Milestone.INSPECTED | Milestone.DELIVERED },
      SELO_ERROR__SHIPPED_NOT_REQUIRED,
    );
  });

  it("rejects unknown milestone bits", async () => {
    await expectCreateError(
      { requiredMilestones: Milestone.SHIPPED | 0x10 },
      SELO_ERROR__INVALID_MILESTONE,
    );
  });

  it("rejects an empty attester list", async () => {
    await expectCreateError({ attesters: [] }, SELO_ERROR__INVALID_ATTESTERS);
  });

  it("rejects more than four attesters", async () => {
    const a = { key: ctx.inspector.address, milestones: Milestone.SHIPPED };
    const others = [ctx.eudr, ctx.surveyor, ctx.stranger, ctx.financier].map(
      (s) => ({ key: s.address, milestones: Milestone.SHIPPED }),
    );
    await expectCreateError(
      { attesters: [a, ...others] },
      SELO_ERROR__INVALID_ATTESTERS,
    );
  });

  it("rejects duplicate attesters", async () => {
    const a = { key: ctx.inspector.address, milestones: Milestone.SHIPPED };
    await expectCreateError(
      { attesters: [a, a] },
      SELO_ERROR__INVALID_ATTESTERS,
    );
  });

  it("rejects an attester with an empty or unknown mask", async () => {
    await expectCreateError(
      { attesters: [{ key: ctx.inspector.address, milestones: 0 }] },
      SELO_ERROR__INVALID_ATTESTERS,
    );
    await expectCreateError(
      { attesters: [{ key: ctx.inspector.address, milestones: 0x20 }] },
      SELO_ERROR__INVALID_ATTESTERS,
    );
  });

  it("rejects the seller as attester", async () => {
    await expectCreateError(
      {
        attesters: [{ key: ctx.seller.address, milestones: Milestone.SHIPPED }],
      },
      SELO_ERROR__INVALID_ATTESTERS,
    );
  });

  it("rejects buyer == seller", async () => {
    await expectCreateError(
      { buyer: ctx.seller.address },
      SELO_ERROR__INVALID_PARTIES,
    );
  });
});
