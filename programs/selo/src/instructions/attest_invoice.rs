use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::InvoiceAttested, state::*};

#[derive(Accounts)]
pub struct AttestInvoice<'info> {
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [SEAL_SEED, seal.invoice_hash.as_ref()],
        bump = seal.bump,
        has_one = buyer,
    )]
    pub seal: Account<'info, Seal>,
}

pub fn handle_attest_invoice(ctx: Context<AttestInvoice>) -> Result<()> {
    let seal = &mut ctx.accounts.seal;
    require!(
        matches!(seal.status, SealStatus::Sealed | SealStatus::Locked),
        SeloError::InvalidStatus
    );
    require!(!seal.buyer_attested, SeloError::AlreadyAttested);
    seal.buyer_attested = true;

    emit!(InvoiceAttested {
        seal: seal.key(),
        invoice_hash: seal.invoice_hash,
        buyer: seal.buyer,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
