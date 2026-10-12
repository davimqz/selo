# Security

Selo is a hackathon project deployed **only on Solana devnet**. It moves test tokens only and has
**not been audited**. Do not deploy it to mainnet or use it with real funds.

## Reporting a vulnerability

Please report security issues privately through GitHub's
[security advisories](https://github.com/davimqz/selo/security/advisories/new) rather than in a
public issue. Include the instruction or file involved, the steps to reproduce and the impact you
expect. You will get an answer within a few days.

## What Selo protects

Selo protects one property: **an invoice is financed by at most one lender among the lenders that
check the registry**, and only after the company that owes it has confirmed it.

It does *not* custody funds, price risk, lend or hold collateral. The only value the program moves
is the lock fee, from the locking lender to the treasury.

## Threat model

### Actors

| Actor | Can do | Trusted for |
|---|---|---|
| Supplier | Seal and cancel its own invoices | Nothing; the main adversary in invoice fraud |
| Buyer (verified company) | Attest invoices addressed to its verified wallet | Telling the truth about its own debts |
| Lender | Lock attested invoices; release its own locks | Paying the fee; releasing when paid |
| Admin (registry operator) | Initialize; register and deactivate lenders; verify and revoke buyers; pause | Verifying buyer identity off-chain (KYB) |
| Anyone | Read every account; call `checkInvoice()` | Nothing |

### Attacks and how the program answers

| # | Attack | Defence | Test |
|---|---|---|---|
| 1 | Finance the same invoice with two lenders | `lock_invoice` requires `Sealed`; a `Locked` invoice fails with `InvoiceAlreadyLocked` for everyone, including the holder | `lock.test.ts` |
| 2 | Register the same invoice twice, typed differently | Canonical hash → the same PDA; `init` fails | `seal.test.ts`, `hash.test.ts` |
| 3 | Re-register an invoice after it was cancelled or paid | Seals are never closed; the PDA stays occupied forever | `seal.test.ts` |
| 4 | Supplier attests its own invented invoice | `attest_invoice` requires the signer's active `Buyer` record (KYB) | `buyer.test.ts` |
| 5 | Supplier gets a different verified company to attest | `lock_invoice` derives the `Buyer` from the tax ID on the invoice and requires its wallet to be `Seal.buyer` (`BuyerMismatch`) | `buyer.test.ts` |
| 6 | Impersonate an existing company with a new wallet | One `Buyer` PDA per tax ID hash: a second registration fails | `buyer.test.ts` |
| 7 | Lock as a lender using another lender's account | `Lender` PDA is derived from the signer | `lock.test.ts` |
| 8 | Divert the fee or pay it in another token or from another account | `has_one` treasury and fee mint; source token account must belong to the signer; `transfer_checked` | `lock.test.ts` |
| 9 | Release (unlock) someone else's financing | `release_invoice` requires `Seal.lender == signer` | `lock.test.ts` |
| 10 | Take over the registry between deploy and initialize | `initialize` requires the program's upgrade authority | `admin.test.ts` |
| 11 | Block a seal by pre-funding its PDA with lamports | Sealing still succeeds | `seal.test.ts` |
| 12 | Keep operating with a compromised lender or buyer key | Admin deactivates the lender or revokes the buyer; new locks and attestations against them fail | `lock.test.ts`, `buyer.test.ts` |
| 13 | Ongoing incident | Admin pauses: sealing and locking stop; reads continue | `admin.test.ts`, `seal.test.ts`, `lock.test.ts` |

Every attack in the table is covered by a test that runs against the compiled program
([Testing](README.md#testing)).

### Out of scope, by design

- **Collusion between a supplier and the real buyer.** If the verified company attests an invoice
  it knows is fake, the registry faithfully records a genuine attestation. Selo removes the
  *double* in double financing, not every form of fraud.
- **Lenders who never check.** The registry only protects lenders that consult it. Its value grows
  with each lender that joins.
- **Legal effect.** A lock records which lender financed an invoice; it does not replace the
  assignment contract.

## Privacy

- Only the hash of the canonical invoice, the two parties' wallets, the face amount, currency and
  due date are stored on-chain. Names, invoice numbers and documents are not.
- Invoices are hashed in the browser; the raw data never reaches a server.
- **The hash is not strong secrecy.** Tax IDs have little entropy. Someone who already knows both
  parties and can guess the invoice number, amount and due date can recompute the hash. The
  roadmap includes stronger schemes, such as commitments with a salt shared among lenders, or
  zero-knowledge proofs.

## Centralization on devnet

On devnet, one admin key (the program's upgrade authority) does the following:
- registers lenders;
- verifies buyers;
- can pause the registry.

The admin key *cannot* do any of these:
- move, unlock or re-assign an existing seal;
- change who financed an invoice;
- take fees from anyone but a lender who signs a lock.

For production, the plan is:
- put the admin and upgrade keys in a Squads multisig;
- accept KYB credentials from several accredited providers (for example on the Solana Attestation
  Service);
- get an independent audit before any mainnet deployment.

## Operational security in this repository

- No private key is committed. `.gitignore` covers keypairs, `wallets/`, `id.json` and `.env*`.
  Only `target/idl` JSON is tracked under `target`.
- The browser RPC URL (`NEXT_PUBLIC_RPC_URL`) is public by nature. It must be a free devnet key
  restricted to the app's domain.
- Demo mode, which signs with local demo wallets for screen recording, has these safeguards:
  - it is off by default;
  - it only serves keys on `localhost` with `SELO_DEMO_MODE=1`;
  - it always returns 404 on Vercel.
