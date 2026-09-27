use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::SeloError, events::DealRefunded, state::*};

/// Permissionless crank: returns the escrow to the buyer if nothing shipped
/// by the latest shipment date. After SHIPPED there is no on-chain refund.
#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [DEAL_SEED, deal.seller.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = usdc_mint,
        has_one = buyer,
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        mut,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump = deal.vault_bump,
        token::mint = usdc_mint,
        token::authority = deal,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = deal.buyer,
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    /// CHECK: receives the vault rent back; constrained by `has_one = buyer`.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_refund(ctx: Context<Refund>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deal = &ctx.accounts.deal;

    require!(
        matches!(deal.status, DealStatus::Funded | DealStatus::Advanced),
        SeloError::InvalidStatus
    );
    require!(!deal.has_milestone(SHIPPED), SeloError::AlreadyShipped);
    require!(now > deal.expires_at, SeloError::DealNotExpired);

    let amount = ctx.accounts.vault.amount;
    let seller = deal.seller;
    let deal_id = deal.deal_id.to_le_bytes();
    let bump = [deal.bump];
    let seeds: &[&[u8]] = &[DEAL_SEED, seller.as_ref(), &deal_id, &bump];
    let signer: &[&[&[u8]]] = &[seeds];

    if amount > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.buyer_token.to_account_info(),
                    authority: ctx.accounts.deal.to_account_info(),
                },
                signer,
            ),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;
    }

    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.buyer.to_account_info(),
            authority: ctx.accounts.deal.to_account_info(),
        },
        signer,
    ))?;

    let deal = &mut ctx.accounts.deal;
    deal.status = DealStatus::Refunded;

    emit!(DealRefunded {
        deal: deal.key(),
        amount,
        timestamp: now,
    });
    Ok(())
}
