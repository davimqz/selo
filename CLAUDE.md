# CLAUDE.md — Selo: the global registry that stops the same invoice from being financed twice

Permanent project context for any Claude Code session in this repository. Read it before touching
any module. The step-by-step plan is in `TASKS.md`; the working prompts are in `docs/prompts.md`.

Reference date: 06 Oct 2026. Hackathon deadline (Colosseum Crypto World's Fair, Solana track):
**12 Oct 2026**. Check the time and time zone on the platform; do not assume them.

## 1. What this project is

**Selo is a public, neutral invoice registry on Solana. Before financing an invoice, any lender
checks Selo; if another lender has already financed it, the second operation is blocked.**

- **The problem:** receivables are financed by lenders who cannot see each other. The same invoice
  can be assigned to two lenders, or an invented invoice can be financed several times. In the
  First Brands collapse, prosecutors allege fake invoices and collateral pledged two or three
  times, with billions in losses for creditors.
- **What Selo does:** each invoice becomes an account derived from the canonical hash of its data.
  Sealing the same invoice again fails. A lender "locks" the invoice when it finances it; a second
  lender that tries to lock it is rejected and sees who financed it first.
- **What Selo is NOT:** it is not a lender, it has no pool, it does not lend money and it does not
  compete with credit protocols. **Credit protocols and factoring companies are Selo's customers,
  not its competitors.**
- **Why Solana:** checking and locking cost fractions of a cent and confirm in under a second, so
  small invoices can be registered and checked in real time inside the credit flow.

**Scope of this version:** a working demo on devnet. No mainnet, no real money.

## 2. Golden rule: 6 days, frozen scope

The test for any doubt: **does this appear in the demo video, or in the tests that prove the
demo?** If not, it does not go in.

The demo has exactly five moments:

1. The supplier seals an invoice (only the hash goes on-chain).
2. The buyer attests that the invoice is real and due.
3. **Lender A** checks, sees "free" and locks the invoice.
4. **Lender B** tries to lock the same invoice and is **rejected**, seeing "already financed by A
   on DD/MM".
5. Someone tries to seal the same invoice typed differently (lowercase, spaces) and is
   **rejected**.

Moments 4 and 5 sell the project and must not fail in the video.

## 3. Technical stack

| Layer | Choice | Why |
|---|---|---|
| On-chain program | Rust + Anchor (current stable version; check it, do not pin it from memory) | Ecosystem standard; the IDL generates the TS client. |
| Tests | Anchor TypeScript tests on the local validator (or LiteSVM if the setup is quick) | Iteration in seconds. |
| SDK | `packages/sdk` in TypeScript: canonical hash, program client, `checkInvoice()` | It is what a lender integrates. Part of the product, not a detail. |
| Frontend | Next.js (App Router, TypeScript) on Vercel Hobby | Free, deploys in minutes. |
| Wallet | Wallet Standard + `@solana/react` (Phantom) | `@solana/kit` signers go straight into the SDK builders; the classic Wallet Adapter would require web3.js v1 (decided on 06 Oct). |
| RPC | Helius devnet (free tier) | The public devnet RPC rate-limits at the worst moment. |
| Fee token | Test mint `USDC-dev` (6 decimals) created by a script | To charge the lock fee in the demo. Labelled as a test token across the UI. |

## 4. Program accounts (Anchor)

Every PDA stores its `bump`. Amounts are `u64` (minor units); intermediate calculations use `u128`
with `checked_*`.

| Account | Seeds | Main fields |
|---|---|---|
| `Config` | `["config"]` | `admin`, `treasury`, `fee_mint`, `lock_fee` (flat amount per lock), `paused`, `bump` |
| `Lender` | `["lender", lender_pubkey]` | `name` (up to 32 bytes), `active`, `locks_count` |
| `Buyer` | `["buyer", tax_id_hash]` | `authority` (wallet or multisig vault), `tax_id_hash = sha256("v1\|party\|" + canonical tax ID)`, `name`, `active`, `verified_at` |
| `Seal` | `["seal", invoice_hash]` | `invoice_hash`, `supplier`, `buyer`, `face_amount`, `currency` (3 bytes, ISO 4217), `due_ts`, `status`, `buyer_attested`, `lender`, `locked_at`, `created_at`, `bump` |

`status`: `Sealed → Locked → Released`, or `Sealed → Cancelled`. `buyer_attested` is an
independent flag that only the buyer sets. No other transition is valid.

## 5. Canonical hash: what makes "only once" work

Two people registering the same invoice must reach the same hash. The normalization is specified,
versioned and tested:

```
v1|<buyer tax ID, letters and digits only, uppercase>|<supplier tax ID, same>|<invoice number, trimmed + uppercase + inner spaces removed>|<amount in minor units, integer>|<ISO 4217 currency>|<due date YYYY-MM-DD>
```

`invoice_hash = sha256(string above, UTF-8)`.

- The `v1|` prefix lets the format evolve without colliding with old hashes.
- **Do not salt the hash:** a per-user salt would stop two lenders from detecting the same
  invoice, which is the whole point.
- **Limitations (they are in the README, and in the pitch if asked):** tax IDs have little
  entropy, so the hash is not strong secrecy against someone who already knows the parties. Selo
  only detects duplicates **among those who check the registry**, which is why its value grows
  with every lender that joins. The seal does not replace the assignment contract.
- Only `face_amount`, `currency` and `due_ts` go on-chain in clear (a lender needs them to
  decide); no names, descriptions or documents.

## 6. Instructions

| # | Instruction | Signer | Essential checks |
|---|---|---|---|
| 1 | `initialize` | admin | `lock_fee` within a limit; mint with 6 decimals |
| 2 | `register_lender(name)` / `set_lender_active` | admin | name not empty |
| 2b | `register_buyer(tax_id_hash, name)` / `set_buyer_active` | admin (KYB verifier on devnet) | name not empty; one `Buyer` per tax ID (the PDA is the uniqueness) |
| 3 | `seal_invoice(hash, buyer, face, currency, due_ts)` | supplier | `init` of the PDA (**the duplicate fails here**); `face > 0`; `due_ts` in the future; not paused |
| 4 | `attest_invoice` | buyer | `Seal.buyer == signer`; status `Sealed` or `Locked`; **the signer's `Buyer` is active** |
| 5 | `lock_invoice` | lender | lender registered and active; status `Sealed`; **`buyer_attested == true`**; **the `Buyer` derived from the invoice's tax ID has `authority == Seal.buyer` and is active**; charges `lock_fee` in `fee_mint` to `treasury`; records `lender` and `locked_at` |
| 6 | `release_invoice` | the same lender | status `Locked`; `Seal.lender == signer` (marks the invoice as paid/closed) |
| 7 | `cancel_seal` | supplier | only in `Sealed` |
| 8 | `set_paused` | admin | — |

When `lock_invoice` fails because the status is `Locked`, the custom error must carry useful
information, and the SDK must translate it: "already financed by <lender name> on <date>".

Emit an Anchor event for each state instruction (`InvoiceSealed`, `InvoiceAttested`,
`InvoiceLocked`, `InvoiceReleased`, `InvoiceCancelled`). A rejected attempt emits no event,
because the whole transaction fails; it appears only on screen and in the SDK log.

## 7. SDK (`packages/sdk`)

- `canonicalize(invoice)` and `invoiceHash(invoice)`: pure, with test vectors.
- `checkInvoice(connection, invoice | hash)` → `{ status: 'free' | 'sealed' | 'locked' |
  'released' | 'cancelled', lender?, lockedAt?, attested }`. **It is the call a lender puts in
  its credit flow; the pitch shows it.**
- Builders for the instructions in Section 6, and translation of program errors into readable
  messages.

## 8. Frontend (four screens)

| Route | Used by | What it does |
|---|---|---|
| `/fornecedor` | supplier | invoice form → hash computed in the browser → seal; list of their seals |
| `/comprador` | buyer | invoices sealed against them → "Attest" |
| `/financiador` | lender | paste the invoice data → check → "Finance (lock)". In the demo, two wallets: Lender A and Lender B |
| `/verificar` | anyone | data or hash → public state of the invoice. The open registry page |

A "Devnet — test tokens" banner on every screen. No raw Anchor error is shown to the user.

## 9. Business model (for the pitch and the README)

- Revenue: **a fee per locked invoice**, paid by the lender. In the demo it is a flat amount in
  `USDC-dev`.
- Pricing assumption (not market data): 5 basis points of face value per lock.
- Size reference: global factoring moved about €4.04 trillion in 2025 (FCI). If 1% of that volume
  went through Selo at 5 bps, that is about €20 million a year.
- Why the lender pays: the fee costs less than a single loss to double assignment, and the
  registry becomes more valuable with every lender that joins (network effect).

## 10. Fixed rules (do not reopen without a new reason)

- **Never mainnet, never real money, never promise yield.**
- **No token of our own, no pool, no lending.** If the temptation to "add a pool" comes up,
  reread Section 1.
- **No private key in the repository.** `.gitignore` covers keypairs (`*.json` outside
  `target/idl`), `.env*`, `node_modules`, `target`.
- **Public repository** (open source is a Colosseum judging criterion).
- **No automatic push to `main` and no unrestricted permission mode** in this project: work on a
  branch and merge when the tests pass.
- The project is global: no specific jurisdiction is named in the product, the README or the
  pitch.

## 11. Required tests before the video

1. Sealing the same invoice twice → fails, including with different formatting.
2. Lender B locking an invoice already locked by A → fails with a translatable error.
3. Locking without the buyer's attestation → fails.
4. Wrong signer on each instruction → fails.
5. `release_invoice` only by the lender that locked.
6. The lock fee reaches the `treasury` with the exact amount.
7. An inactive lender cannot lock; the pause blocks sealing and locking.
8. Canonical hash vectors in `packages/sdk`.
9. An unverified or revoked buyer cannot attest; locking fails if the attester is not the verified
   company on the invoice (`BuyerMismatch`).

**Invariant:** `Seal` accounts are never closed. Closing a `Released` or `Cancelled` seal to
reclaim rent would delete the PDA and allow the same invoice to be sealed and financed again.

## 12. Folder structure

```
programs/selo/   # Anchor program
packages/sdk/    # canonical hash, checkInvoice, client
app/             # Next.js
scripts/         # USDC-dev mint, initialize, register lenders, seed the demo
tests/           # program tests
docs/            # pitch.md, prompts.md, demo script
```

## 13. Submission materials

- Pitch video of at most 3 minutes (`docs/pitch.md`).
- Technical video with the five moments of Section 2, if the form asks for it.
- README: the problem in 3 lines, how to run it, the devnet Program ID, the app link, a usage
  example of `checkInvoice()` and the limitations from Section 5.
- Check the eligibility rules on the form before submitting.
