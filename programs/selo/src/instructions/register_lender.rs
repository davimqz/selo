use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, state::*};

#[derive(Accounts)]
pub struct RegisterLender<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    /// CHECK: any wallet; it becomes the lender's signing authority.
    pub lender_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Lender::INIT_SPACE,
        seeds = [LENDER_SEED, lender_authority.key().as_ref()],
        bump,
    )]
    pub lender: Account<'info, Lender>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_lender(ctx: Context<RegisterLender>, name: String) -> Result<()> {
    require!(
        !name.trim().is_empty() && name.len() <= MAX_LENDER_NAME_LEN,
        SeloError::InvalidLenderName
    );
    ctx.accounts.lender.set_inner(Lender {
        authority: ctx.accounts.lender_authority.key(),
        name,
        active: true,
        locks_count: 0,
        bump: ctx.bumps.lender,
    });
    Ok(())
}
