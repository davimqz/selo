# @selo/sdk

The TypeScript SDK for [Selo](../../README.md), the invoice registry that stops the same invoice
from being financed twice. It contains:
- the canonical invoice hash;
- `checkInvoice()`, the call a lender puts in its credit flow;
- the instruction builders, generated from the program's IDL with Codama on `@solana/kit` 8;
- readable translations of every program error.

The app, the scripts and the tests in this repository all use it. The package is not published to
npm yet; inside the workspace it is `"@selo/sdk": "workspace:*"`.

## Check an invoice before financing it

```ts
import { createSolanaRpc } from "@solana/kit";
import { checkInvoice } from "@selo/sdk";

const rpc = createSolanaRpc("https://devnet.helius-rpc.com/?api-key=<KEY>");

const check = await checkInvoice(rpc, {
  buyerTaxId: "US 94-1081436",
  supplierTaxId: "DE 811 907 980",
  number: "INV-2026-0042",
  amount: 1_250_000n, // minor units
  currency: "USD",
  dueDate: "2027-01-15",
});

if (check.status === "locked") {
  console.log(`Already financed by ${check.lender?.name} on ${check.lockedAt}`);
}

const safeToFinance =
  check.status === "sealed" &&
  check.attested &&
  check.buyer?.verification === "verified";
```

`checkInvoice(rpc, invoice | hash)` returns an `InvoiceCheck`:

| Field | Meaning |
|---|---|
| `status` | `"free"` (never sealed), `"sealed"`, `"locked"`, `"released"` or `"cancelled"` |
| `seal` | The invoice's `Seal` address, derived even when it does not exist yet |
| `attested` | Whether the buyer attested that the invoice is real and due |
| `buyer` | The buyer wallet and `verification`, as described below |
| `lender`, `lockedAt` | Who locked the invoice, and when |
| `terms` | Face amount, currency and due date stored on-chain |

The values of `verification` are:
- `"verified"`: the buyer wallet is the verified wallet of the company on the invoice.
- `"mismatch"`: that company is verified, but with another wallet. Do not finance.
- `"unverified"`: the company on the invoice is not verified in the registry.
- `"unknown"`: the check was made from a bare hash, without the invoice data.

## Canonical hash

```ts
import { canonicalize, invoiceHash, toHex } from "@selo/sdk";

canonicalize({
  buyerTaxId: "us 94-1081436",
  supplierTaxId: "de 811 907 980",
  number: "  inv-2026-0042 ",
  amount: 1_250_000n,
  currency: "usd",
  dueDate: "2027-01-15",
});
// "v1|US941081436|DE811907980|INV-2026-0042|1250000|USD|2027-01-15"

toHex(invoiceHash(invoice)); // sha256 of the canonical string, 64 hex characters
```

Inputs that cannot be normalized (empty fields, a negative or fractional amount, an unknown date
format) throw an `InvalidInvoiceError`. The format is specified in the
[main README](../../README.md#canonical-invoice-hash), and golden vectors pin it in
[`test/hash.test.ts`](test/hash.test.ts).

## Reference

| Export | Purpose |
|---|---|
| `checkInvoice(rpc, invoice \| hash)` | Registry status, buyer verification, lender and terms |
| `canonicalize`, `invoiceHash`, `sealArgs` | Canonical string, 32-byte hash, and the arguments of `seal_invoice` |
| `canonicalTaxId`, `canonicalNumber`, `canonicalAmount`, `canonicalCurrency`, `canonicalDueDate` | The individual normalization rules |
| `partyIdHash(taxId)`, `findBuyerRecordByTaxId(taxId)` | The tax ID hash and the `Buyer` PDA of a company |
| `listSeals(rpc, { supplier } \| { buyer })` | Every seal sent by a supplier or addressed to a buyer |
| `listBuyerRecords(rpc, wallet)` | The verified identities of a wallet |
| `explainError(err, { rpc, invoice }?)` | A readable sentence for any failed transaction, including who financed a locked invoice and when |
| `describeSeloError(code)`, `seloErrorCode(err)` | Program error code ↔ message |
| `toHex`, `fromHex` | Hash encoding |
| `SELO_PROGRAM_ADDRESS`, `get*Instruction`, `fetch*`, `find*Pda` | The generated client (`src/generated`, do not edit; run `pnpm codegen`) |

## Tests

```bash
pnpm exec vitest run packages/sdk   # from the repository root
```
