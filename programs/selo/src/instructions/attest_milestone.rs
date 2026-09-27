use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::MilestoneAttested, state::*};

#[derive(Accounts)]
#[instruction(milestone: u8)]
pub struct AttestMilestone<'info> {
    #[account(mut)]
    pub attester: Signer<'info>,
    #[account(
        mut,
        seeds = [DEAL_SEED, deal.seller.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        constraint = is_single_known_milestone(milestone) @ SeloError::InvalidMilestone,
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        init,
        payer = attester,
        space = MilestoneRecord::DISCRIMINATOR.len() + MilestoneRecord::INIT_SPACE,
        seeds = [MILESTONE_SEED, deal.key().as_ref(), &[milestone]],
        bump
    )]
    pub milestone_record: Account<'info, MilestoneRecord>,
    pub system_program: Program<'info, System>,
}

pub fn handle_attest_milestone(
    ctx: Context<AttestMilestone>,
    milestone: u8,
    evidence_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let attester = ctx.accounts.attester.key();
    let deal = &ctx.accounts.deal;

    require!(
        matches!(deal.status, DealStatus::Funded | DealStatus::Advanced),
        SeloError::InvalidStatus
    );
    require!(
        deal.required_milestones & milestone != 0,
        SeloError::MilestoneNotRequired
    );
    require!(
        deal.attester_mode == ATTESTER_MODE_ALLOWLIST
            && deal.allowlist_authorizes(&attester, milestone),
        SeloError::UnauthorizedAttester
    );
    // SHIPPED must happen by the latest shipment date. After that date, other
    // milestones are only accepted for shipped deals (unshipped ones are refundable).
    if now > deal.expires_at {
        require!(
            milestone != SHIPPED && deal.has_milestone(SHIPPED),
            SeloError::ShipmentDeadlinePassed
        );
    }

    let record = &mut ctx.accounts.milestone_record;
    record.deal = deal.key();
    record.milestone = milestone;
    record.attester = attester;
    record.evidence_hash = evidence_hash;
    record.sas_attestation = Pubkey::default();
    record.attested_at = now;
    record.bump = ctx.bumps.milestone_record;

    let deal = &mut ctx.accounts.deal;
    deal.attested_milestones |= milestone;

    emit!(MilestoneAttested {
        deal: deal.key(),
        milestone,
        attester,
        evidence_hash,
        timestamp: now,
    });
    Ok(())
}
