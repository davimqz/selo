use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::DealCancelled, state::*};

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
        has_one = seller,
        close = seller,
    )]
    pub deal: Account<'info, Deal>,
    /// CHECK: receives the deal rent back; constrained by `has_one = seller`.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,
}

pub fn handle_cancel(ctx: Context<Cancel>) -> Result<()> {
    let deal = &ctx.accounts.deal;
    require!(deal.status == DealStatus::Created, SeloError::InvalidStatus);

    emit!(DealCancelled {
        deal: deal.key(),
        by: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
