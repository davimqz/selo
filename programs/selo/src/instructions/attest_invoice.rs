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
    /// The signer's verified identity: only a KYB-verified company can attest.
    #[account(
        seeds = [BUYER_SEED, buyer_record.tax_id_hash.as_ref()],
        bump = buyer_record.bump,
        constraint = buyer_record.authority == buyer.key() @ SeloError::BuyerNotVerified,
        constraint = buyer_record.active @ SeloError::BuyerNotVerified,
    )]
    pub buyer_record: Account<'info, Buyer>,
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
