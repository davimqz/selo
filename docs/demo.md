# Demo guide: Selo on devnet

The five demo moments from the [project brief](../CLAUDE.md#2-golden-rule-6-days-frozen-scope),
running in the browser against devnet. Nothing here uses real money: devnet SOL and `USDC-dev`
are test tokens.

> **Recorded demo:** [the five moments on YouTube](https://www.youtube.com/watch?v=keZ3Au-Aty0).

> **Just want to see it work?** No wallet needed: open
> [`/verificar`](https://selo-iota-three.vercel.app/verificar), choose **Invoice hash** and paste
> `987403bcf71b7cb4655aeb1bd500703888890f56eea9cf36411e9b9786c0c90c`, an invoice already financed
> by Lender A on devnet.

## Current devnet state

| | |
|---|---|
| Program ID | `4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio` |
| Upgrade authority / admin | `HERNv3AsBwEkM6Zv5yLnuezpVpusLH8pxkP6U58iJiYW` |
| `USDC-dev` mint | `Gj8cs9urnjgy29Nz3k5EQNrJZLbapCDSi55X4SU4xAqv` |
| Lock fee | 1 `USDC-dev` |
| Verified demo buyer | **Demo Buyer Inc.**, tax ID `US 94-1081436` |

Demo wallets (registered by `seed-demo`):

| Role | Address |
|---|---|
| Supplier | `FsCADJoZuEzBc1CL2sq6vabDiJCMinFjUbpgGwHsLmx1` |
| Buyer | `HEASFybTa9mAU1Hq5HCWBJkoAj2tkMq1icJKMiSfff1H` |
| Lender A | `9KHvoV6iuvNrCY7cjgYctSNhCLs9Y6hMt9xuAo5YgRtS` |
| Lender B | `42GWhAZrqCAXzdGT6PwjbkLtoBniq81qJkU6hNeLt33B` |

The private keys live only in `scripts/wallets/demo/` (git-ignored), with a `PHANTOM-IMPORT.txt`
ready to import. Never commit them. To run the demo on your own registry, generate your own
wallets and pass their addresses to `seed-demo`.

## 1. Set up (once)

1. **RPC.** Put `RPC_URL=<Helius devnet URL>` in `.env` and `NEXT_PUBLIC_RPC_URL=<same URL>` in
   `app/.env.local`; the template is `.env.example`. The public devnet RPC returns HTTP 429 in the
   middle of a demo, so always use Helius.
2. **Phantom.** Import each wallet from `PHANTOM-IMPORT.txt` with *Add account → Import private
   key*, naming them Supplier, Buyer, Lender A and Lender B. In *Settings → Developer settings*,
   turn on testnet mode and choose **Solana Devnet**.
3. **Funds.** `seed-demo` is idempotent. Running it before each recording tops up SOL (0.1 per
   wallet) and `USDC-dev` (1,000 per lender):

   ```bash
   LENDER_A=<A> LENDER_B=<B> SUPPLIER=<supplier> BUYER=<buyer> pnpm seed-demo
   ```

4. **Automatic check.** `pnpm e2e-demo 3` runs the five moments three times through the app's own
   transaction code, with its own wallets ("E2E Lender A/B"). If it passes, devnet and the RPC are
   healthy.

## 2. Start the app

```bash
cd app
npx next build && npx next start -p 3000   # lighter than `next dev`
```

Open http://localhost:3000, or use the deployed app at
[selo-iota-three.vercel.app](https://selo-iota-three.vercel.app). The "Devnet — test tokens only"
banner must be at the top. To switch roles, switch the account in Phantom and, in the app, choose
*Connect wallet → Reconnect*.

## 3. The five moments

Use a new invoice number for each run (`INV-2026-0043`, `0044`, …). A sealed invoice stays in the
registry forever, which is the point.

1. **The supplier seals.** Account *Supplier*, `/fornecedor`.
   - Click *Fill the example invoice*, change the number, paste the buyer's address, then
     **Seal invoice**.
   - Show the canonical form and the hash computed in the browser: only the hash goes on-chain.
2. **The buyer attests.** Account *Buyer*, `/comprador`.
   - The *Verified identity* card shows **Demo Buyer Inc.**, the buyer that `seed-demo` verified
     for tax ID `US 94-1081436` (the one in the example invoice).
   - The invoice appears in the list; click **Attest**.
   - Always use this buyer tax ID. With another one, the lender screen shows "not verified" and
     the lock fails.
3. **Lender A locks.** Account *Lender A*, `/financiador`.
   - Type the invoice data and click **Check registry**. A hash is enough to look an invoice up,
     but locking needs the data, because the program checks the buyer against the tax ID on the
     invoice.
   - The screen shows "Sealed — not financed", *Buyer identity: Verified: Demo Buyer Inc.* and
     *Buyer attested: Yes*.
   - Click **Finance (lock invoice)**.
4. **Lender B is rejected.** Account *Lender B*, same screen, same invoice.
   - The status already reads "Financed by Lender A". Click **Finance** anyway.
   - The red stamp appears: *"Rejected by the Selo program — Already financed by Lender A on DD
     Mon YYYY. It cannot be financed twice."*
   - The wallet never asks for a signature, because the app simulates the transaction against the
     program first.
5. **A retyped duplicate is rejected.** Account *Supplier*, `/fornecedor`.
   - Enter the same invoice in lowercase and with spaces (`de 811 907 980`, ` inv-2026-0043 `).
   - The hash is identical, so **Seal** returns *"This invoice is already registered in Selo. It
     cannot be registered twice."*

Optional for the video: `/verificar` shows the same state without a wallet, and the *seal
account ↗* link opens the account in Solana Explorer.

## Demo mode (no Phantom)

Demo mode lets you record without switching accounts in Phantom. The app stays the same and the
transactions are real devnet transactions; only the signing changes, as the browser signs with
the wallets in `scripts/wallets/demo`.

1. Add `SELO_DEMO_MODE=1` to `app/.env.local`.
2. Run `pnpm --filter app demo`. It builds the app and serves it at http://localhost:3000, bound
   to 127.0.0.1 only.
3. In the purple "Demo mode" bar, choose **Supplier**.
   - The role follows the screen: `/comprador` signs as Buyer, and `/financiador` as Lender A,
     with a **Lender B** button next to it.
   - **My wallet** goes back to Phantom.

Shortcuts that only appear in demo mode:

- `/fornecedor`: **New demo invoice** generates a fresh number for each take, with the buyer's
  address already filled in.
- `/financiador`: **Use the sealed demo invoice** fills in the last sealed invoice.
- `/fornecedor`, after sealing: **Same invoice, typed differently** fills in the same invoice in
  lowercase and with spaces (moment 5).

The route that serves the keys (`/api/demo-wallets`) returns 404 in each of these cases:
- the flag is not set;
- the request does not come from `localhost`;
- the app runs on Vercel.

The keys never enter the repository or the published bundle.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `HTTP error (429): Too Many Requests` | Public devnet RPC. Use Helius in `.env` and `app/.env.local`. |
| Deploy: `Data writes to account failed: Max retries exceeded` | The public RPC dropped writes. Recover the buffer's SOL with `solana program close <buffer> --url devnet --bypass-warning`, then retry with `solana program deploy target/deploy/selo.so --program-id target/deploy/selo-keypair.json --url devnet --max-sign-attempts 100 --with-compute-unit-price 50000`. |
| The app server stops on its own | Low memory on Windows. Run `wsl --shutdown` (the app does not need WSL), close heavy tabs, and use `next start` instead of `next dev`. If port 3000 stays busy, end the old `node` process. |
| "This wallet has no devnet SOL to pay the network fee." | Run `seed-demo` again. |
| `/comprador`: "This wallet is not verified as a company" | The connected account is not the demo *Buyer*, or `seed-demo` has not run since the buyer registry was added. Run `seed-demo` with `BUYER=<buyer>`. |
| Lock: "The buyer on the invoice is not verified" / *not verified* | The buyer tax ID typed is not `US 94-1081436`. |
| "This lender is not registered in Selo." | The connected account is not Lender A or B. Check the account in Phantom, or run `seed-demo` with the right address. |
| Phantom shows the wrong transaction or a zero balance | Phantom is not on devnet. Turn on testnet mode and choose Solana Devnet. |

## Security notes

- The Helius URL ships to the browser (`NEXT_PUBLIC_`). Restrict the key to the app's domain in the
  Helius dashboard.
- Wallet and deploy keys never enter the repository: `.gitignore` covers `wallets/`,
  `*-keypair.json`, `id.json` and `.env*`.
