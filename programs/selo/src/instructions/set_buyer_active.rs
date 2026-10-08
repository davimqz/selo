use anchor_lang::prelude::*;

use crate::{constants::*, state::*};

/// Revokes (or restores) a buyer's verification. A revoked buyer can no longer
/// attest, and invoices it attested can no longer be locked.
#[derive(Accounts)]
pub struct SetBuyerActive<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [BUYER_SEED, buyer_record.tax_id_hash.as_ref()],
        bump = buyer_record.bump,
    )]
    pub buyer_record: Account<'info, Buyer>,
}

pub fn handle_set_buyer_active(ctx: Context<SetBuyerActive>, active: bool) -> Result<()> {
    ctx.accounts.buyer_record.active = active;
    Ok(())
}
