use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::SeloError, events::DealSettled, state::*};

/// Permissionless crank: anyone can trigger settlement once it is due.
#[derive(Accounts)]
pub struct Settle<'info> {
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
        token::authority = deal.seller,
    )]
    pub seller_token: Account<'info, TokenAccount>,
    /// Required only if the deal was advanced.
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = deal.financier,
    )]
    pub financier_token: Option<Account<'info, TokenAccount>>,
    /// CHECK: receives the vault rent back (paid by the buyer at funding).
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_settle(ctx: Context<Settle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deal = &ctx.accounts.deal;

    require!(
        matches!(deal.status, DealStatus::Funded | DealStatus::Advanced),
        SeloError::InvalidStatus
    );
    require!(
        deal.has_milestone(deal.required_milestones),
        SeloError::MissingMilestones
    );
    require!(now >= deal.payment_due_at, SeloError::PaymentNotDue);

    let vault_balance = ctx.accounts.vault.amount;
    let to_financier = if deal.status == DealStatus::Advanced {
        deal.repay_amount
    } else {
        0
    };
    let to_seller = vault_balance
        .checked_sub(to_financier)
        .ok_or(SeloError::MathOverflow)?;

    let seller = deal.seller;
    let deal_id = deal.deal_id.to_le_bytes();
    let bump = [deal.bump];
    let seeds: &[&[u8]] = &[DEAL_SEED, seller.as_ref(), &deal_id, &bump];
    let signer: &[&[&[u8]]] = &[seeds];
    let decimals = ctx.accounts.usdc_mint.decimals;

    // Financier is repaid first.
    if to_financier > 0 {
        let financier_token = ctx
            .accounts
            .financier_token
            .as_ref()
            .ok_or(SeloError::InvalidStatus)?;
        transfer_from_vault(
            ctx.accounts,
            financier_token.to_account_info(),
            to_financier,
            decimals,
            signer,
        )?;
    }
    if to_seller > 0 {
        transfer_from_vault(
            ctx.accounts,
            ctx.accounts.seller_token.to_account_info(),
            to_seller,
            decimals,
            signer,
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
    deal.status = DealStatus::Settled;

    emit!(DealSettled {
        deal: deal.key(),
        to_financier,
        to_seller,
        timestamp: now,
    });
    Ok(())
}

fn transfer_from_vault<'info>(
    accounts: &Settle<'info>,
    to: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer: &[&[&[u8]]],
) -> Result<()> {
    token::transfer_checked(
        CpiContext::new_with_signer(
            accounts.token_program.key(),
            TransferChecked {
                from: accounts.vault.to_account_info(),
                mint: accounts.usdc_mint.to_account_info(),
                to,
                authority: accounts.deal.to_account_info(),
            },
            signer,
        ),
        amount,
        decimals,
    )
}
