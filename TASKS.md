# TASKS.md — Execution plan (06 Oct → 12 Oct 2026)

Organized by day, because the deadline is the dominant constraint. Tick each item (`[x]`) when it
is done. If a day slips, **cut from the end of that day's list, never from its definition of
done**. Decision rule: `CLAUDE.md` Section 2.

---

## Day 0 — Tuesday 06 Oct · Foundation (or adapting what already exists)

- [x] If code already exists: run the "Adapt the existing project" prompt from `docs/prompts.md` and follow the approved plan before any other task.
- [x] Public GitHub repository with the folders from `CLAUDE.md` Section 12, working on a branch (`dev`).
- [x] Anchor program `selo` building and `anchor test` running (even if empty).
- [x] `.gitignore` as in `CLAUDE.md` Section 10.
- [x] Helius devnet RPC in `.env` (never committed) + documented `.env.example`.
- [ ] Message 5–10 people who finance receivables (factoring companies, credit fintechs, on-chain credit protocols, treasuries): *"Before financing an invoice, would you check a global registry that shows whether another lender has already financed it?"*

**Definition of done**: public repository, program building, tests running.

---

## Day 1 — Wednesday 07 Oct · Canonical hash + seal

- [x] `packages/sdk/src/hash.ts`: `canonicalize` and `invoiceHash` exactly as in `CLAUDE.md` Section 5.
- [x] Hash test vectors (different formatting → same hash; one different field → different hash).
- [x] Accounts `Config`, `Lender`, `Seal`; instructions `initialize`, `register_lender`, `set_lender_active`, `seal_invoice`, `cancel_seal`, `set_paused`.
- [x] Test 1 from `CLAUDE.md` Section 11 (sealing twice fails).

**Definition of done**: the duplicate-seal test passes on the local validator.

---

## Day 2 — Thursday 08 Oct · Attestation + lock + SDK

- [x] Script `scripts/create-mint.ts` (`USDC-dev`, 6 decimals) and minting to the test wallets.
- [x] `attest_invoice`, `lock_invoice` (charging the fee), `release_invoice`.
- [x] Custom "already locked" error and its translation in the SDK ("already financed by X on DD/MM").
- [x] `checkInvoice()` in the SDK.
- [x] All tests from `CLAUDE.md` Section 11 passing.
- [x] Anchor events on the state instructions.

**Definition of done**: the five demo moments pass as an automated test, without a frontend.

---

## Day 3 — Friday 09 Oct · Devnet + frontend

- [x] `anchor deploy` to devnet; Program ID in the README and in `Anchor.toml`.
- [x] Idempotent `scripts/seed-demo.ts`: initialize, register "Lender A" and "Lender B", give both `USDC-dev`.
- [x] Next.js + Wallet Standard (`@solana/react`) + `packages/sdk`.
- [x] Screens `/fornecedor`, `/comprador`, `/financiador`, `/verificar`.
- [x] Readable error messages; "Devnet — test tokens" banner.

**Definition of done**: the five moments run in the browser against devnet, three times in a row without errors.

---

## Day 4 — Saturday 10 Oct · Publish and record the demo

- [ ] Deploy to Vercel and test in a private window with another wallet.
- [x] Complete README (`CLAUDE.md` Section 13), with a code snippet using `checkInvoice()`.
- [x] Update `docs/pitch.md` with real validation (or remove the validation sentence).
- [x] 8 pitch slides.
- [ ] Record the technical video of the five moments.

**Definition of done**: public app working and technical video recorded.

---

## Day 5 — Sunday 11 Oct · Record the pitch and submit

- [ ] Recheck the pitch numbers and time it (target 2:45).
- [ ] Record the pitch.
- [ ] Review eligibility and the form fields.
- [ ] **Submit today.** Merge `dev` into `main` and freeze.

**Definition of done**: submission confirmed on the platform.

---

## Reserve — Monday 12 Oct

- [ ] Only fixes that do not put the demo at risk.

---

## Pre-approved cuts (in this order)

1. `/comprador` screen → attestation by script, shown in the explorer.
2. `release_invoice` → described in the README as the next step.
3. Fee charging → free locking in the demo, fee model only in the pitch.
4. `/verificar` screen → the lookup appears inside `/financiador`.

**Never cut:** duplicate seal rejected, second lender rejected, devnet deployment, `checkInvoice()` in the SDK.

---

## After the hackathon (do not do before 12 Oct)

- [ ] Buyer attestation through a multisig vault (Squads).
- [ ] Wallet-less lookup through an HTTP API, for traditional lenders.
- [ ] Stronger privacy for the hash (a commitment with a salt shared among lenders, or zero-knowledge proofs).
- [ ] Program audit and a legal opinion on receivables assignment by jurisdiction.
- [ ] Reading the registry from other networks.
