use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::SeloError, events::InvoiceLocked, state::*};

#[derive(Accounts)]
pub struct LockInvoice<'info> {
    pub lender_authority: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = fee_mint,
        has_one = treasury,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [LENDER_SEED, lender_authority.key().as_ref()],
        bump = lender.bump,
    )]
    pub lender: Account<'info, Lender>,
    #[account(
        mut,
        seeds = [SEAL_SEED, seal.invoice_hash.as_ref()],
        bump = seal.bump,
    )]
    pub seal: Account<'info, Seal>,
    /// The verified company named on the invoice, derived by the lender from
    /// the buyer tax ID in the invoice data it holds. The lock only goes
    /// through if that company's wallet is the one that attested.
    #[account(
        seeds = [BUYER_SEED, buyer_record.tax_id_hash.as_ref()],
        bump = buyer_record.bump,
    )]
    pub buyer_record: Account<'info, Buyer>,
    pub fee_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = fee_mint,
        token::authority = lender_authority,
    )]
    pub lender_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_lock_invoice(ctx: Context<LockInvoice>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let seal = &ctx.accounts.seal;

    require!(!ctx.accounts.config.paused, SeloError::Paused);
    require!(ctx.accounts.lender.active, SeloError::LenderInactive);
    if seal.status == SealStatus::Locked {
        // Errors carry no data: log who holds the lock so any client can show
        // it. The SDK also reads it from the Seal and Lender accounts.
        msg!("Locked by {} at {}", seal.lender, seal.locked_at);
        return err!(SeloError::InvoiceAlreadyLocked);
    }
    require!(seal.status == SealStatus::Sealed, SeloError::InvalidStatus);
    require!(seal.buyer_attested, SeloError::NotAttested);
    let buyer_record = &ctx.accounts.buyer_record;
    require!(
        buyer_record.authority == seal.buyer,
        SeloError::BuyerMismatch
    );
    require!(buyer_record.active, SeloError::BuyerNotVerified);

    let fee = ctx.accounts.config.lock_fee;
    if fee > 0 {
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.lender_token.to_account_info(),
                    mint: ctx.accounts.fee_mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.lender_authority.to_account_info(),
                },
            ),
            fee,
            ctx.accounts.fee_mint.decimals,
        )?;
    }

    let lender = &mut ctx.accounts.lender;
    lender.locks_count = lender
        .locks_count
        .checked_add(1)
        .ok_or(SeloError::MathOverflow)?;

    let seal = &mut ctx.accounts.seal;
    seal.status = SealStatus::Locked;
    seal.lender = ctx.accounts.lender_authority.key();
    seal.locked_at = now;

    emit!(InvoiceLocked {
        seal: seal.key(),
        invoice_hash: seal.invoice_hash,
        lender: seal.lender,
        fee,
        timestamp: now,
    });
    Ok(())
}
