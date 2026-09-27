# Selo — implementation plan

Status: **Phase 0 (setup) — awaiting review.** Nothing below Phase 0 is implemented yet.

## 0. Toolchain (pinned)

| Tool | Version | Pinned in |
| --- | --- | --- |
| Rust (program build) | 1.89.0 | `rust-toolchain.toml` |
| Solana CLI (Agave) | 4.1.2 | `Anchor.toml [toolchain]`, CI |
| Anchor CLI / `anchor-lang` | 1.2.0 | `Anchor.toml [toolchain]`, `programs/selo/Cargo.toml`, CI |
| `@anchor-lang/core` (TS client) | 1.2.0 | `package.json` |
| Node | 24 | `.nvmrc`, `engines` |
| pnpm | 12.6.0 | `packageManager` |
| LiteSVM (TS) | 0.8.0 | `package.json` |
| Next.js | 16.3.6 | `app/package.json` |

Notes:
- `litesvm@1.x` is built on `@solana/kit`, while `@anchor-lang/core` 1.2 still uses `@solana/web3.js` v1.
  We pin `litesvm@0.8.0` (the web3.js v1 line) so tests can use the Anchor TS client directly.
- LiteSVM ships no Windows binary. Program build and tests run in **WSL (Ubuntu)** locally and on
  `ubuntu-latest` in CI. The Next.js app runs on either.

## 1. Repository layout

```
Anchor.toml  Cargo.toml  rust-toolchain.toml  package.json  pnpm-workspace.yaml
programs/selo/        Anchor program (Rust)
tests/                TypeScript tests on LiteSVM (fast, in-process)
scripts/              TS scripts: mock USDC mint (Phase 0), seed-demo (Phase 4)
app/                  Next.js App Router + Tailwind (Phase 3)
docs/                 plan, architecture, demo/pitch scripts, roadmap
.github/workflows/    CI: lint (prettier, rustfmt, clippy, eslint) + build + tests
```

## 2. Program design

### 2.1 Constants

Milestones are bit flags so a deal can store "required" and "attested" sets in one byte:

| Milestone | Bit |
| --- | --- |
| `INSPECTED` | `1 << 0` |
| `SHIPPED` | `1 << 1` |
| `EUDR_COMPLIANT` | `1 << 2` |
| `DELIVERED` | `1 << 3` |

Document types: `BILL_OF_LADING = 0`, `COMMERCIAL_INVOICE = 1`, `CPR = 2` (Cédula de Produto Rural).

`BPS_DENOMINATOR = 10_000`, `MAX_ATTESTERS = 4`.

### 2.2 Accounts

#### `Deal` — PDA `["deal", seller, deal_id.to_le_bytes()]`

`deal_id: u64` is chosen by the seller (client uses a timestamp/nonce), so one seller can run many deals.

| Field | Type | Notes |
| --- | --- | --- |
| `deal_id` | `u64` | seed |
| `seller` | `Pubkey` | creator, receives advance and balance |
| `buyer` | `Pubkey` | funds escrow; may attest `DELIVERED` |
| `usdc_mint` | `Pubkey` | every token account is checked against it |
| `amount` | `u64` | escrow amount (base units) |
| `max_advance_bps` | `u16` | cap for the financier advance |
| `advance_fee_bps` | `u16` | financier fee on the advanced principal |
| `required_milestones` | `u8` | must be ⊆ `attested_milestones` to settle; always includes `DELIVERED` |
| `attested_milestones` | `u8` | updated by `attest_milestone` |
| `documents` | `u8` | bitmask of registered doc types (B/L required for `advance`) |
| `attester_mode` | `u8` | `0 = Allowlist`, `1 = Sas` (Phase 2) |
| `attesters` | `[AttesterEntry; 4]` | `{ key: Pubkey, milestones: u8 }`; unused slots = default key |
| `sas_credential` | `Pubkey` | Phase 2, default until then (reserved now to avoid realloc) |
| `sas_schema` | `Pubkey` | Phase 2, idem |
| `financier` | `Pubkey` | set by `advance` (default = none) |
| `advanced_amount` | `u64` | principal paid to seller |
| `repay_amount` | `u64` | principal + fee, paid first on `settle` |
| `status` | `DealStatus` | `Created → Funded → Advanced → Settled`, or `→ Refunded / Cancelled` |
| `created_at`, `expires_at` | `i64` | `expires_at` = deadline for `DELIVERED` |
| `bump`, `vault_bump` | `u8` | canonical bumps stored at init |

Invariant enforced at `create_deal`: `max_advance_bps * (10_000 + advance_fee_bps) <= 10_000²`,
so `repay_amount <= amount` always and settlement can never underflow the vault.

#### `Vault` — SPL token account PDA `["vault", deal]`

`token::mint = deal.usdc_mint`, `token::authority = deal` (the Deal PDA signs transfers). Created in
`fund_escrow` (payer = buyer), closed on `settle`/`refund` with rent returned to the buyer.

#### `DocumentRecord` — PDA `["doc", doc_hash]`

| Field | Type |
| --- | --- |
| `doc_hash` | `[u8; 32]` |
| `doc_type` | `u8` |
| `deal` | `Pubkey` |
| `registered_by` | `Pubkey` |
| `registered_at` | `i64` |
| `bump` | `u8` |

`doc_hash = sha256("selo:doc:v1" || doc_type || canonical(issuer) || canonical(number) || salt)`, computed
client-side; only the hash goes on-chain. **Never closed** — closing it would re-open the door to
double pledging. The existence of the PDA *is* the anti-double-pledge lock.

To surface a readable error instead of the System Program's generic "account already in use", the
instruction takes the PDA as an unchecked account with a `seeds` constraint and, if it already holds
program-owned data, fails with `DocumentAlreadyRegistered`. Creation uses transfer + allocate + assign
(not `create_account`), so a griefer pre-funding the PDA with lamports cannot block registration.

#### `MilestoneRecord` — PDA `["milestone", deal, milestone_bit]`

| Field | Type | Notes |
| --- | --- | --- |
| `deal` | `Pubkey` | |
| `milestone` | `u8` | single bit |
| `attester` | `Pubkey` | who signed |
| `evidence_hash` | `[u8; 32]` | hash of inspection report / photo / EUDR DDS reference |
| `sas_attestation` | `Pubkey` | Phase 2 (default in allowlist mode) |
| `attested_at` | `i64` | |
| `bump` | `u8` | |

Created with `init`, so each milestone can be attested exactly once per deal. Gives the timeline a
queryable record besides the event log.

### 2.3 Instructions

Every instruction: signer checks, `has_one`/constraints, canonical bumps, mint + owner checks on token
accounts, `checked_*` math, explicit status transitions.

| # | Instruction | Signer(s) | Preconditions | Effects |
| --- | --- | --- | --- | --- |
| 1 | `create_deal(deal_id, amount, max_advance_bps, advance_fee_bps, required_milestones, attesters, expires_at)` | seller | `amount > 0`; bps invariant; `expires_at > now`; `DELIVERED ∈ required`; each attester has a non-empty mask | init `Deal` (`Created`) |
| 2 | `fund_escrow()` | buyer | `deal.buyer == signer`; status `Created`; not expired; buyer ATA mint == deal mint | init vault, transfer `amount` → vault; status `Funded` |
| 3 | `register_document(doc_hash, doc_type)` | seller | `deal.seller == signer`; status `Created`/`Funded`; doc type not yet on this deal | create `DocumentRecord`; set bit in `deal.documents`; **fails with `DocumentAlreadyRegistered` if the hash exists anywhere** |
| 4 | `attest_milestone(milestone, evidence_hash)` | attester | status `Funded`/`Advanced`; not expired; single valid bit ∈ `required`; signer authorized for that bit (allowlist entry, or buyer for `DELIVERED`; SAS in Phase 2) | init `MilestoneRecord`; set bit in `attested_milestones` |
| 5 | `advance(amount)` | financier | status `Funded`; B/L registered; `SHIPPED` attested; `amount <= deal.amount * max_advance_bps / 10_000`; financier ≠ seller/buyer; not expired | transfer financier ATA → seller ATA; record financier, principal, repay; status `Advanced` |
| 6 | `settle()` | anyone (crank) | status `Funded`/`Advanced`; `required ⊆ attested` | vault → financier `repay_amount` (if any), rest → seller; close vault; status `Settled` |
| 7 | `refund()` | anyone (crank) | status `Funded`/`Advanced`; `now > expires_at`; `DELIVERED` not attested | vault → buyer; close vault; status `Refunded` |
| 8 | `cancel()` | seller or buyer | status `Created` (nothing funded) | status `Cancelled`, close `Deal` to seller |

Demo step 4 ("buyer confirms DELIVERED → escrow pays out automatically") is one transaction with
`attest_milestone(DELIVERED)` + `settle` built by the client.

Demo step 2 ("second financier tries to finance the same B/L"): the exporter opens a second deal and
tries to register the same B/L → `DocumentAlreadyRegistered`; `advance` on that deal is impossible
because it requires a registered B/L.

### 2.4 Errors (`SeloError`)

`InvalidAmount`, `InvalidBps`, `InvalidExpiry`, `InvalidMilestone`, `MilestoneNotRequired`,
`MilestoneAlreadyAttested`, `TooManyAttesters`, `UnauthorizedAttester`, `InvalidDocumentType`,
`DocumentAlreadyRegistered`, `DocumentTypeAlreadyOnDeal`, `BillOfLadingMissing`, `NotShipped`,
`AdvanceExceedsLimit`, `AlreadyAdvanced`, `FinancierIsParty`, `NotDelivered`, `MissingMilestones`,
`DealExpired`, `DealNotExpired`, `InvalidStatus`, `MintMismatch`, `MathOverflow`,
Phase 2: `InvalidSasAttestation`, `SasAttestationExpired`.

Each maps to a user-facing message in the app (Phase 3).

### 2.5 Events (`emit!`)

`DealCreated`, `EscrowFunded`, `DocumentRegistered`, `MilestoneAttested`, `AdvanceFunded`,
`DealSettled { to_financier, to_seller }`, `DealRefunded`, `DealCancelled`. All carry `deal` and a
timestamp; the `/deal/[id]` timeline is built from these plus the account state.

### 2.6 Phase 2 preview — SAS

Verified in the SAS repo (`solana-foundation/solana-attestation-service`): program
`22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`; `Attestation` PDA
`["attestation", credential, schema, nonce]` with fields `nonce, credential, schema, data, signer,
expiry, token_account`. Plan: Selo issues a Credential with a schema "selo-attester-role" whose
`data` is a `u8` milestone mask, and uses the attester's wallet as `nonce`. `attest_milestone` reads
the attestation account (no CPI): owner == SAS program, PDA re-derived with `nonce = signer`,
`credential/schema == deal`, `expiry == 0 || expiry > now`, milestone bit ∈ data. Allowlist stays
as fallback via `deal.attester_mode`. Devnet program ID to be confirmed before Phase 2.

## 3. Tests (Phase 1)

LiteSVM (in-process, clock control via `setClock`). Per instruction, a happy path plus failures,
including: duplicate document (same deal and cross-deal), unauthorized attester, attester with the
wrong milestone bit, advance above limit, advance without B/L / without `SHIPPED`, second advance,
settle without `DELIVERED`, refund before expiry, refund after `DELIVERED`, swapped accounts (other
deal's vault, wrong mint, ATA of the wrong owner), double settle.

## 4. Decisions that need your OK

1. **Salt in the document hash.** If each registrant picks a random salt, the same B/L produces
   different hashes and double pledging becomes possible again. Proposal: the salt is *not* free —
   MVP uses no per-user salt (domain separator `selo:doc:v1` + canonicalized fields). Trade-off: a B/L
   number is guessable, so someone could learn "this B/L is registered on Selo". Roadmap: issuer-provided
   salt (eBL platform / carrier), which keeps determinism and adds privacy.
2. **Refund after an advance.** If the deadline passes without `DELIVERED`, the vault returns to the
   buyer and the financier's recourse is off-chain against the seller (recourse factoring). Alternative:
   a dispute window — more code, not in the demo.
3. **One financier, one advance per deal.** Enough for the demo; syndication goes to the roadmap.
4. **Fee and advance cap are set by the seller at `create_deal`**; the financier accepts by calling
   `advance`. No on-chain negotiation.
5. **Buyer may attest `DELIVERED`** without being in the allowlist (they are the party at risk).
6. **`settle` and `refund` are permissionless cranks**, so the payout is "automatic" and nobody can hold
   funds hostage by not signing.
7. **`emit!` (log events) rather than `emit_cpi!`**: simpler; logs are small, so truncation risk is low.

## 5. Roadmap parking lot

Items outside the demo go to `docs/roadmap.md` (Phase 5): Token-2022 transfer-hook receivables,
attester staking/slashing, PayFi pools, PSAV off-ramp, dispute window, syndicated advances,
issuer-salted document hashes.
