# Pitch

The script for the pitch video (target 2:45, limit 3:00), the numbers behind it and answers to the
questions judges are likely to ask. The script follows the 8-slide deck; each section is one slide.

> **Recorded pitch:** [watch on YouTube](https://www.youtube.com/watch?v=FW5T28l-9iA).

## Script

| # | Slide | Time |
|---|---|---:|
| 1 | Cover | 0:08 |
| 2 | The problem | 0:22 |
| 3 | The solution | 0:20 |
| 4 | Live demo | 0:45 |
| 5 | How it works | 0:18 |
| 6 | Market and business model | 0:22 |
| 7 | Roadmap | 0:12 |
| 8 | Team and close | 0:15 |
| | **Total** | **2:42** |

### 1. Cover: "One invoice. One lender. Ever."

> Hi, I'm Davi. This is Selo: a public registry that makes sure an invoice can only be financed
> once.

### 2. The problem

> In 2025, First Brands collapsed. Prosecutors allege fake invoices, and receivables pledged two
> or three times to different lenders. Creditors lost billions. The root cause is simple: lenders
> who finance invoices can't see each other. Each one only sees its own book, so the same invoice
> can be sold twice, and nobody notices until it's too late.

### 3. The solution: credit infrastructure

> Selo is a neutral registry on Solana. The supplier seals the invoice; only a hash goes on-chain.
> The buyer, a verified company, confirms it's real. The first lender to finance it locks it, and
> any other lender is rejected. Selo is credit infrastructure: we don't compete with lenders, we
> serve them. Factoring firms and on-chain credit protocols are our customers, and they pay a
> small fee in USDC every time they lock an invoice.

### 4. Live demo (screen recording)

> Here it is live on devnet. The supplier seals an invoice. The buyer, verified as Demo Buyer
> Inc., attests it. Lender A checks: free, attested, and locks it for a one-dollar fee. Now
> Lender B tries to finance the same invoice… *(pause 1 s)* …rejected: "Already financed by
> Lender A." And if someone retypes the same invoice in lowercase with extra spaces to sneak it
> in again… also rejected.

Leave each red rejection on screen for 2 seconds. Recording steps: [demo.md](demo.md).

### 5. How it works

> Under the hood, every invoice is normalized and hashed into a single on-chain address, so it
> can only exist once. Buyers are verified, so a fraudster can't confirm their own fake invoice.
> For a lender, it's one line of code in their credit flow. And on Solana, a check costs a
> fraction of a cent and confirms in under a second, so you can check every invoice, even small
> ones, in real time.

### 6. Market and business model

> Factoring moved about four trillion euros in 2025. We charge the lender a small fee per locked
> invoice; our assumption is 5 basis points. At just 1% of that volume, that's around 20 million
> euros a year. Lenders pay because the fee is far smaller than a single double-financing loss,
> and every new lender makes the registry more valuable for all the others.

### 7. Roadmap

> Today, Selo is live on devnet with an open-source SDK. Next: pilots with factoring firms and
> credit protocols, KYB providers for buyer verification, an HTTP API for traditional lenders,
> then an audit and mainnet.

If the video runs over 3:00, cut this slide first.

### 8. Team and close

> I'm Davi, *[one line: background, or why you understand credit or Solana]*. Selo: one invoice,
> one lender, ever. Thank you.

## The numbers

| Claim | Value | Source or basis |
|---|---|---|
| Global factoring volume, 2025 | ≈ €4.04 trillion | FCI (Factors Chain International) annual statistics |
| Price per lock | 5 bps of face value | **Assumption**, not market data |
| Revenue at 1% of volume | ≈ €20 million / year | €4.04T × 1% × 0.05% |
| Lock fee on devnet | 1 `USDC-dev` | `Config.lock_fee`, test token |
| Confirmation time | under a second | Solana devnet, measured in the demo |
| First Brands | fake invoices and receivables pledged more than once, as alleged by prosecutors | Public reporting on the 2025 bankruptcy and indictment; described as allegations |

## Questions judges are likely to ask

**Why does this need a blockchain?** Lenders compete with each other and will not hand their book
to a registry run by one of them. A public program on Solana is neutral: anyone can read the
rules, nobody can edit the record, and the uniqueness check is enforced by the runtime, not by an
operator. It also costs a fraction of a cent per write, which a shared database run by a
consortium would not match in practice.

**What stops a supplier from simply not using Selo?** Nothing, and it does not need to. Lenders are
the ones who check. Once a lender requires a seal before it funds, a supplier that wants financing
from that lender has to seal. The protection grows with every lender that joins.

**Can the supplier invent the buyer's confirmation?** No. Only a wallet the registry has verified
as that company (KYB) can attest. The lock also fails unless the attesting wallet belongs to the
company on the invoice the lender holds ([trust model](../README.md#trust-model-verified-buyers)).

**Isn't the invoice data public?** Only a hash, the amount, the currency and the due date are
on-chain. The hash is not strong secrecy against someone who already knows both companies
([limitations](../README.md#limitations)); stronger privacy is on the roadmap.

**What if two people type the invoice differently?** Normalization absorbs case, spacing and
punctuation, so they get the same hash. That is demo moment 5. Variations it cannot absorb, such
as `INV-1` versus `INV-0001`, are documented, and a versioned `v2` format can tighten them.

**Who verifies the buyers in production?** On devnet, the admin key. In production, accredited KYB
providers issuing credentials (for example on the Solana Attestation Service), with the admin and
upgrade keys in a multisig.

**Do you compete with credit protocols?** No. Selo has no pool, no loans and no token. Lenders and
credit protocols are its customers.
