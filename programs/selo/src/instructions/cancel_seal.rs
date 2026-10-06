use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::InvoiceCancelled, state::*};

#[derive(Accounts)]
pub struct CancelSeal<'info> {
    pub supplier: Signer<'info>,
    /// Kept (status `Cancelled`) rather than closed, so the same invoice
    /// cannot be sealed again and its history stays public.
    #[account(
        mut,
        seeds = [SEAL_SEED, seal.invoice_hash.as_ref()],
        bump = seal.bump,
        has_one = supplier,
    )]
    pub seal: Account<'info, Seal>,
}

pub fn handle_cancel_seal(ctx: Context<CancelSeal>) -> Result<()> {
    let seal = &mut ctx.accounts.seal;
    require!(seal.status == SealStatus::Sealed, SeloError::InvalidStatus);
    seal.status = SealStatus::Cancelled;

    emit!(InvoiceCancelled {
        seal: seal.key(),
        invoice_hash: seal.invoice_hash,
        supplier: seal.supplier,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
