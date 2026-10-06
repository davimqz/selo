use anchor_lang::prelude::*;

use crate::{constants::*, state::*};

#[derive(Accounts)]
pub struct SetLenderActive<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [LENDER_SEED, lender.authority.as_ref()],
        bump = lender.bump,
    )]
    pub lender: Account<'info, Lender>,
}

pub fn handle_set_lender_active(ctx: Context<SetLenderActive>, active: bool) -> Result<()> {
    ctx.accounts.lender.active = active;
    Ok(())
}
