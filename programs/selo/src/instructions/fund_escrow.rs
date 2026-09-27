use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::SeloError, events::EscrowFunded, state::*};

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [DEAL_SEED, deal.seller.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = buyer,
        has_one = usdc_mint,
    )]
    pub deal: Account<'info, Deal>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = buyer,
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = buyer,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = deal,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deal = &ctx.accounts.deal;
    require!(deal.status == DealStatus::Created, SeloError::InvalidStatus);
    require!(now <= deal.expires_at, SeloError::DealExpired);
    let amount = deal.amount;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.buyer_token.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let deal = &mut ctx.accounts.deal;
    deal.status = DealStatus::Funded;
    deal.vault_bump = ctx.bumps.vault;

    emit!(EscrowFunded {
        deal: deal.key(),
        buyer: deal.buyer,
        amount,
        timestamp: now,
    });
    Ok(())
}
