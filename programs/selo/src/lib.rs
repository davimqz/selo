//! Selo — programmable letter of credit on Solana.
//!
//! A USDC escrow paid against documents: shipment attestations release it at
//! maturity, a document registry makes double pledging impossible, and a
//! financier's advance is repaid first at settlement. See `docs/plan.md`.

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio");

#[program]
pub mod selo {
    use super::*;

    pub fn create_deal(ctx: Context<CreateDeal>, args: CreateDealArgs) -> Result<()> {
        instructions::create_deal::handle_create_deal(ctx, args)
    }

    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        instructions::fund_escrow::handle_fund_escrow(ctx)
    }

    pub fn register_document(
        ctx: Context<RegisterDocument>,
        doc_hash: [u8; 32],
        doc_type: u8,
    ) -> Result<()> {
        instructions::register_document::handle_register_document(ctx, doc_hash, doc_type)
    }

    pub fn attest_milestone(
        ctx: Context<AttestMilestone>,
        milestone: u8,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        instructions::attest_milestone::handle_attest_milestone(ctx, milestone, evidence_hash)
    }

    pub fn advance(ctx: Context<Advance>, amount: u64) -> Result<()> {
        instructions::advance::handle_advance(ctx, amount)
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handle_settle(ctx)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::refund::handle_refund(ctx)
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel::handle_cancel(ctx)
    }
}
