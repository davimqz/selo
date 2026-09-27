use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::DealCancelled, state::*};

/// Cancels an unfunded deal. The account is kept (status `Cancelled`) instead
/// of closed, so the deal address can never be re-created with other terms
/// while a buyer's funding transaction is in flight.
#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        constraint = authority.key() == deal.seller || authority.key() == deal.buyer
            @ SeloError::InvalidParties,
    )]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [DEAL_SEED, deal.seller.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Account<'info, Deal>,
}

pub fn handle_cancel(ctx: Context<Cancel>) -> Result<()> {
    let deal = &mut ctx.accounts.deal;
    require!(deal.status == DealStatus::Created, SeloError::InvalidStatus);
    deal.status = DealStatus::Cancelled;

    emit!(DealCancelled {
        deal: deal.key(),
        by: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
