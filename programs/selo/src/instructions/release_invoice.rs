use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::InvoiceReleased, state::*};

#[derive(Accounts)]
pub struct ReleaseInvoice<'info> {
    pub lender_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEAL_SEED, seal.invoice_hash.as_ref()],
        bump = seal.bump,
        constraint = seal.lender == lender_authority.key() @ SeloError::NotLockHolder,
    )]
    pub seal: Account<'info, Seal>,
}

/// Marks the invoice paid / closed. The account stays, so it can never be
/// sealed or locked again.
pub fn handle_release_invoice(ctx: Context<ReleaseInvoice>) -> Result<()> {
    let seal = &mut ctx.accounts.seal;
    require!(seal.status == SealStatus::Locked, SeloError::InvalidStatus);
    seal.status = SealStatus::Released;

    emit!(InvoiceReleased {
        seal: seal.key(),
        invoice_hash: seal.invoice_hash,
        lender: seal.lender,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
