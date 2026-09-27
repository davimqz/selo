use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::SeloError, events::AdvanceFunded, state::*};

#[derive(Accounts)]
pub struct Advance<'info> {
    pub financier: Signer<'info>,
    #[account(
        mut,
        seeds = [DEAL_SEED, deal.seller.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = usdc_mint,
    )]
    pub deal: Account<'info, Deal>,
    /// The B/L the financier verified off-chain (canonical hash recomputed client-side).
    #[account(
        seeds = [DOC_SEED, bill_of_lading.doc_hash.as_ref()],
        bump = bill_of_lading.bump,
        constraint = bill_of_lading.key() == deal.bill_of_lading
            && bill_of_lading.deal == deal.key()
            && bill_of_lading.doc_type == DOC_BILL_OF_LADING
            @ SeloError::BillOfLadingMismatch,
    )]
    pub bill_of_lading: Account<'info, DocumentRecord>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = financier,
    )]
    pub financier_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = deal.seller,
    )]
    pub seller_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_advance(ctx: Context<Advance>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let financier = ctx.accounts.financier.key();
    let deal = &ctx.accounts.deal;

    require!(deal.status == DealStatus::Funded, SeloError::InvalidStatus);
    require!(deal.has_milestone(SHIPPED), SeloError::NotShipped);
    require!(
        financier != deal.seller && financier != deal.buyer,
        SeloError::FinancierIsParty
    );
    require!(now < deal.payment_due_at, SeloError::PaymentDue);
    require!(amount > 0, SeloError::InvalidAmount);
    let max_advance = deal.max_advance().ok_or(SeloError::MathOverflow)?;
    require!(amount <= max_advance, SeloError::AdvanceExceedsLimit);

    let fee = (amount as u128)
        .checked_mul(deal.advance_fee_bps as u128)
        .and_then(|v| v.checked_div(BPS_DENOMINATOR as u128))
        .ok_or(SeloError::MathOverflow)?;
    let repay_amount = u64::try_from(fee)
        .ok()
        .and_then(|fee| amount.checked_add(fee))
        .ok_or(SeloError::MathOverflow)?;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.financier_token.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.seller_token.to_account_info(),
                authority: ctx.accounts.financier.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let deal = &mut ctx.accounts.deal;
    deal.financier = financier;
    deal.advanced_amount = amount;
    deal.repay_amount = repay_amount;
    deal.status = DealStatus::Advanced;

    emit!(AdvanceFunded {
        deal: deal.key(),
        financier,
        amount,
        repay_amount,
        timestamp: now,
    });
    Ok(())
}
