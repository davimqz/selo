//! PDA seeds and protocol limits.

pub const CONFIG_SEED: &[u8] = b"config";
pub const LENDER_SEED: &[u8] = b"lender";
pub const SEAL_SEED: &[u8] = b"seal";
pub const BUYER_SEED: &[u8] = b"buyer";

/// `USDC-dev`, the lock-fee mint, has 6 decimals.
pub const FEE_MINT_DECIMALS: u8 = 6;
/// Upper bound for the flat lock fee: 100 `USDC-dev`.
pub const MAX_LOCK_FEE: u64 = 100_000_000;
/// Lender display name, in bytes.
pub const MAX_LENDER_NAME_LEN: usize = 32;
/// Verified buyer display name, in bytes.
pub const MAX_BUYER_NAME_LEN: usize = 32;
