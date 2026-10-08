use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    /// Token account (of `fee_mint`) that receives lock fees.
    pub treasury: Pubkey,
    pub fee_mint: Pubkey,
    /// Flat fee per lock, in `fee_mint` minor units.
    pub lock_fee: u64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Lender {
    pub authority: Pubkey,
    #[max_len(MAX_LENDER_NAME_LEN)]
    pub name: String,
    pub active: bool,
    pub locks_count: u64,
    pub bump: u8,
}

/// A buyer whose identity was verified off-chain (KYB) by the registry.
///
/// Keyed by the hash of the buyer's tax ID, so a company has exactly one
/// signing wallet, and anyone holding the invoice data can derive it and check
/// that the wallet attesting an invoice is the company named on it.
#[account]
#[derive(InitSpace)]
pub struct Buyer {
    /// The wallet (or multisig vault) allowed to attest for this company.
    pub authority: Pubkey,
    /// `sha256("v1|party|" + canonical tax ID)`, see `packages/sdk`.
    pub tax_id_hash: [u8; 32],
    #[max_len(MAX_BUYER_NAME_LEN)]
    pub name: String,
    /// Cleared by the admin to revoke the verification.
    pub active: bool,
    pub verified_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum SealStatus {
    Sealed,
    Locked,
    Released,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Seal {
    pub invoice_hash: [u8; 32],
    pub supplier: Pubkey,
    pub buyer: Pubkey,
    /// Face amount in minor units of `currency`.
    pub face_amount: u64,
    /// ISO 4217 code, uppercase ASCII.
    pub currency: [u8; 3],
    pub due_ts: i64,
    pub status: SealStatus,
    /// Set by the buyer only; independent of `status`.
    pub buyer_attested: bool,
    /// The lender that locked the invoice, or default.
    pub lender: Pubkey,
    pub locked_at: i64,
    pub created_at: i64,
    pub bump: u8,
}
