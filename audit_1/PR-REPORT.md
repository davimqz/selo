# Selo — Phase 1 differential audit

- **Method:** auditor-skill `diff-audit` (Mode 4), run inline: context reconstruction of the eight
  instructions, walk against checklists 01 (account validation), 02 (access control), 03
  (arithmetic), 04 (CPI/PDA), 05 (state machine), 06 (economic logic), Rule 5b gate for N ≥ 6.
- **Scope:** `programs/selo/src/**` on branch `feat/program-phase1-core-27-09-2026` (whole program:
  everything is new in this phase). Off-chain code (sdk, tests) out of scope.
- **Not run:** Trail of Bits tooling, fuzzing, peer-review subagent. Full audit is planned for Phase 5.
- **Date:** 2026-09-27

## Executive summary

| Severity | Count | Status |
| --- | --- | --- |
| 🟠 HIGH | 1 | Fixed + regression test |
| 🟡 MEDIUM | 2 | Documented trust assumptions (roadmap / Phase 2) |
| 🔵 LOW | 2 | Open, recommendation |
| ⚪ INFO | 4 | By design |

Repository risk after fixes: **5 (MEDIUM)**, driven by documented design assumptions, not by
exploitable bugs. Tests: 86 passing (every instruction has success and failure paths).

## Findings

### [F-1] Deal bait-and-switch through `cancel` + re-create at the same address — 🟠 7 HIGH — FIXED

`cancel` closed the `Deal` account. The seller could then re-create a deal at the same PDA
(`["deal", seller, deal_id]`) with different terms, in the same transaction, while the buyer's
`fund_escrow` was in flight. `fund_escrow` transfers `deal.amount`, which is not an instruction
argument, so the buyer funds terms they never reviewed.

- **Reachability:** permissionless for the seller of any `Created` deal: `cancel` then
  `create_deal(same deal_id, amount', attesters')` in one tx, ahead of the buyer's `fund_escrow`.
- **Math / state bounds:** buyer loses up to their whole USDC balance (`amount'` is arbitrary); with
  seller-controlled attesters, `settle` later pays the vault to the seller. PoC reproduced it
  (buyer funded 900,000 USDC after reviewing 100,000).
- **Attacker model:** malicious seller, no privileges; needs the buyer to sign a funding tx for the
  address (the normal flow).
- **Fix:** `cancel` sets `status = Cancelled` and keeps the account, so a deal address can never be
  re-initialized; terms at an address are immutable for its lifetime.
- **Regression tests:** `refund-cancel.test.ts` › "audit F-1: a cancelled deal address cannot be
  re-created with other terms"; `fund-escrow.test.ts` › "rejects funding a cancelled deal".

### [F-2] Seller chooses the attester allowlist — 🟡 5 MEDIUM — documented

`create_deal` is signed by the seller only; the buyer accepts the attester set implicitly by funding.
A seller could list a sock-puppet "inspector" who attests `SHIPPED` for goods that never shipped,
unlocking the advance (financier's risk) and, at maturity, settlement (buyer's risk).

- **Mitigation now:** the app must show the attester set (with identities) to the buyer before
  funding and to the financier before advancing (Phase 3 requirement). The seller itself is barred
  from the allowlist (`InvalidAttesters`).
- **Planned:** Phase 2 SAS credentials — attesters are accredited by a credential authority, not by
  the seller.

### [F-3] Document squatting — 🟡 5 MEDIUM — documented (roadmap)

Anyone who knows a B/L number can register its canonical hash first on a deal of their own (a
throwaway deal funded with 1 base unit of a self-made mint costs ~0.01 SOL), blocking the legitimate
exporter's registration (`DocumentAlreadyRegistered`). No funds at risk; denial of financing.

- **Planned:** issuer-confirmed registration (carrier / eBL platform co-signs), already in
  `docs/roadmap.md`. A mint allowlist (F-4) raises the cost slightly but does not solve it.

### [F-4] Any mint accepted — 🔵 3 LOW — open

`create_deal` accepts any SPL Token mint. The escrow is safe against Token-2022 extensions
(`Program<Token>` only), but a buyer or financier could be shown a deal in a look-alike mint.
**Recommendation:** pin the accepted USDC mint per cluster (constant or config account) before the
devnet deploy (Phase 4); the app must display and check the mint regardless.

### [F-5] Funds locked if a post-shipment attester never attests — 🔵 3 LOW — documented

After `SHIPPED` there is no refund; if a required milestone (e.g. `EUDR_COMPLIANT`) is never attested,
the vault cannot be settled or refunded. Intentional L/C semantics (buyer cannot block payment);
recovery (arbiter / attester replacement / dispute window) is on the roadmap.

### Informational

- **I-1** `Deal` (after `Settled`/`Refunded`/`Cancelled`), `MilestoneRecord` and `DocumentRecord`
  accounts are never closed. Intentional: `DocumentRecord` is the anti-double-pledge lock; deals and
  milestones back the timeline and F-1. Rent is small (~0.002–0.005 SOL each).
- **I-2** No admin, pause or upgrade-gated logic in the program: no rug vector, but no emergency stop.
  Upgrade authority governance to be decided before any mainnet use (not in scope: devnet only).
- **I-3** `settle` cannot be blocked by a financier closing their token account: the financier's ATA
  can always be recreated permissionlessly, and the constraint accepts any account they own.
- **I-4** `register_document` uses `saturating_sub` for the missing rent (AR-006). Correct here: it
  computes a lamport top-up where "already over-funded" legitimately means zero.

## Checklist verdicts (condensed)

| Area | Result |
| --- | --- |
| Account validation (01) | PASS — typed `Account`/`Program`; `UncheckedAccount`s carry accurate `/// CHECK:`; PDAs re-derived with stored canonical bumps; token accounts constrained by mint + authority; no `init_if_needed`, no `remaining_accounts` |
| Access control (02) | PASS with F-2 — every value-moving path is gated by signer + `has_one`/constraint; `settle`/`refund` are documented permissionless cranks whose payees are fixed by state |
| Arithmetic (03) | PASS — `checked_*`, u128 intermediates for bps math, `u64::try_from` downcasts, `overflow-checks = true` in release |
| CPI / PDA (04) | PASS — CPI contexts take program `Pubkey`s (Anchor 1.x); token program typed; vault closed only after being drained, rent to the buyer (`has_one`) |
| State machine (05) | PASS after F-1 — status allowlist per instruction; paired time gates are exact complements (`<=`/`>` on `expires_at`, `<`/`>=` on `payment_due_at`); terminal states absorbing; every transition emits an event |
| Economic (06) | PASS with F-3/F-5 — repay ≤ amount enforced at creation; no oracle, no shares, no fee-on-transfer exposure (classic SPL only) |
