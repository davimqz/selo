use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{constants::*, error::SeloError, events::DealCreated, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateDealArgs {
    pub deal_id: u64,
    pub buyer: Pubkey,
    pub amount: u64,
    pub max_advance_bps: u16,
    pub advance_fee_bps: u16,
    pub required_milestones: u8,
    pub attesters: Vec<AttesterEntry>,
    pub expires_at: i64,
    pub payment_due_at: i64,
}

#[derive(Accounts)]
#[instruction(args: CreateDealArgs)]
pub struct CreateDeal<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        init,
        payer = seller,
        space = Deal::DISCRIMINATOR.len() + Deal::INIT_SPACE,
        seeds = [DEAL_SEED, seller.key().as_ref(), &args.deal_id.to_le_bytes()],
        bump
    )]
    pub deal: Account<'info, Deal>,
    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_deal(ctx: Context<CreateDeal>, args: CreateDealArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let seller = ctx.accounts.seller.key();

    require!(args.amount > 0, SeloError::InvalidAmount);
    require!(
        args.buyer != seller && args.buyer != Pubkey::default(),
        SeloError::InvalidParties
    );

    // repay = advance * (1 + fee) must never exceed the escrow amount.
    let lhs = (args.max_advance_bps as u64)
        .checked_mul(
            BPS_DENOMINATOR
                .checked_add(args.advance_fee_bps as u64)
                .ok_or(SeloError::MathOverflow)?,
        )
        .ok_or(SeloError::MathOverflow)?;
    require!(
        lhs <= BPS_DENOMINATOR * BPS_DENOMINATOR,
        SeloError::InvalidBps
    );

    require!(
        now < args.expires_at && args.expires_at <= args.payment_due_at,
        SeloError::InvalidSchedule
    );

    require!(
        args.required_milestones & !ALL_MILESTONES == 0,
        SeloError::InvalidMilestone
    );
    require!(
        args.required_milestones & SHIPPED != 0,
        SeloError::ShippedNotRequired
    );

    let attesters = validate_attesters(&args.attesters, &seller)?;

    let deal = &mut ctx.accounts.deal;
    deal.deal_id = args.deal_id;
    deal.seller = seller;
    deal.buyer = args.buyer;
    deal.usdc_mint = ctx.accounts.usdc_mint.key();
    deal.amount = args.amount;
    deal.max_advance_bps = args.max_advance_bps;
    deal.advance_fee_bps = args.advance_fee_bps;
    deal.required_milestones = args.required_milestones;
    deal.attested_milestones = 0;
    deal.documents = 0;
    deal.bill_of_lading = Pubkey::default();
    deal.attester_mode = ATTESTER_MODE_ALLOWLIST;
    deal.attesters = attesters;
    deal.sas_credential = Pubkey::default();
    deal.sas_schema = Pubkey::default();
    deal.financier = Pubkey::default();
    deal.advanced_amount = 0;
    deal.repay_amount = 0;
    deal.status = DealStatus::Created;
    deal.created_at = now;
    deal.expires_at = args.expires_at;
    deal.payment_due_at = args.payment_due_at;
    deal.bump = ctx.bumps.deal;
    deal.vault_bump = 0;

    emit!(DealCreated {
        deal: deal.key(),
        seller,
        buyer: deal.buyer,
        amount: deal.amount,
        required_milestones: deal.required_milestones,
        expires_at: deal.expires_at,
        payment_due_at: deal.payment_due_at,
        timestamp: now,
    });
    Ok(())
}

fn validate_attesters(
    input: &[AttesterEntry],
    seller: &Pubkey,
) -> Result<[AttesterEntry; MAX_ATTESTERS]> {
    require!(
        !input.is_empty() && input.len() <= MAX_ATTESTERS,
        SeloError::InvalidAttesters
    );
    let mut out = [AttesterEntry::default(); MAX_ATTESTERS];
    for (i, entry) in input.iter().enumerate() {
        require!(
            entry.key != Pubkey::default()
                && entry.key != *seller
                && entry.milestones != 0
                && entry.milestones & !ALL_MILESTONES == 0
                && !input[..i].iter().any(|prev| prev.key == entry.key),
            SeloError::InvalidAttesters
        );
        out[i] = *entry;
    }
    Ok(out)
}
