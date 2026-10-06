# Selo

A public, neutral invoice registry on Solana that blocks financing the same invoice twice.

- **Problem:** receivables are financed by lenders who cannot see each other, so one invoice can be
  pledged to several lenders, or a fake one financed many times.
- **Solution:** each invoice becomes an account derived from the hash of its canonical fields.
  Sealing it again fails, and once a lender locks it, any other lender trying to lock it is rejected
  and sees who financed it first.
- **Not a lender:** no pool, no loans, no token. Factors and credit protocols are Selo's customers.

> Work in progress for the Colosseum Crypto World's Fair (Solana track). Devnet only, test tokens
> only. Plan: [`TASKS.md`](TASKS.md).

## Layout

```
programs/selo/   Anchor program
packages/sdk/    canonical invoice hash, checkInvoice(), generated client (Codama)
app/             Next.js frontend
scripts/         test mint, initialize, demo seed
tests/           program tests (vitest + LiteSVM)
docs/            pitch, demo script
```

## Development setup

Program build and tests run on Linux (on Windows, use WSL/Ubuntu).

```bash
# 1. System deps (Ubuntu / WSL)
sudo apt-get install -y build-essential pkg-config libudev-dev libssl-dev

# 2. Rust (version pinned by rust-toolchain.toml), Solana CLI 4.1.2, Anchor CLI 1.2.0
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
sh -c "$(curl -sSfL https://release.anza.xyz/v4.1.2/install)"
curl -sSfL -o ~/.local/bin/anchor \
  https://github.com/otter-sec/anchor/releases/download/v1.2.0/anchor-1.2.0-x86_64-unknown-linux-gnu
chmod +x ~/.local/bin/anchor

# 3. Node 24 + pnpm 12 (via corepack)
corepack enable && pnpm install

# 4. Build + test
pnpm test:program      # anchor build → Codama client (packages/sdk/src/generated) → vitest on LiteSVM
pnpm lint              # prettier + rustfmt + clippy + eslint
```

## License

MIT
