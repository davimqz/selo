# Selo

Programmable letter of credit on Solana: a USDC escrow released by shipment attestations, with an
on-chain registry that makes pledging the same trade document (B/L, invoice, CPR) twice impossible,
and financier advances repaid first at settlement.

> Work in progress for the Colosseum Crypto World's Fair. See [`docs/plan.md`](docs/plan.md).

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
pnpm test:program      # anchor build && LiteSVM tests
pnpm lint              # prettier + rustfmt + clippy + eslint

# 5. Local validator with a mock USDC mint
solana-keygen new --no-bip39-passphrase   # once, if you have no ~/.config/solana/id.json
pnpm localnet          # terminal 1
pnpm usdc:mock         # terminal 2 → writes scripts/.localnet.json
```
