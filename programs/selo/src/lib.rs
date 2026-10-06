//! Selo — a public, neutral registry that blocks financing the same invoice twice.
//!
//! Each invoice becomes a PDA derived from the hash of its canonical fields:
//! sealing it again fails, and only one lender can lock it. See `CLAUDE.md`.

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio");

#[program]
pub mod selo {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, lock_fee: u64) -> Result<()> {
        instructions::initialize::handle_initialize(ctx, lock_fee)
    }

    pub fn register_lender(ctx: Context<RegisterLender>, name: String) -> Result<()> {
        instructions::register_lender::handle_register_lender(ctx, name)
    }

    pub fn set_lender_active(ctx: Context<SetLenderActive>, active: bool) -> Result<()> {
        instructions::set_lender_active::handle_set_lender_active(ctx, active)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::set_paused::handle_set_paused(ctx, paused)
    }

    pub fn seal_invoice(
        ctx: Context<SealInvoice>,
        invoice_hash: [u8; 32],
        buyer: Pubkey,
        face_amount: u64,
        currency: [u8; 3],
        due_ts: i64,
    ) -> Result<()> {
        instructions::seal_invoice::handle_seal_invoice(
            ctx,
            invoice_hash,
            buyer,
            face_amount,
            currency,
            due_ts,
        )
    }

    pub fn cancel_seal(ctx: Context<CancelSeal>) -> Result<()> {
        instructions::cancel_seal::handle_cancel_seal(ctx)
    }

    pub fn attest_invoice(ctx: Context<AttestInvoice>) -> Result<()> {
        instructions::attest_invoice::handle_attest_invoice(ctx)
    }

    pub fn lock_invoice(ctx: Context<LockInvoice>) -> Result<()> {
        instructions::lock_invoice::handle_lock_invoice(ctx)
    }

    pub fn release_invoice(ctx: Context<ReleaseInvoice>) -> Result<()> {
        instructions::release_invoice::handle_release_invoice(ctx)
    }
}
