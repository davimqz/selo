use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::{constants::*, error::SeloError, program::Selo, state::*};

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Must be the program's upgrade authority, so nobody can front-run the
    /// deployer and take over the registry's config.
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    #[account(constraint = fee_mint.decimals == FEE_MINT_DECIMALS @ SeloError::InvalidFeeMint)]
    pub fee_mint: Account<'info, Mint>,
    #[account(token::mint = fee_mint)]
    pub treasury: Account<'info, TokenAccount>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, Selo>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(admin.key())
            @ SeloError::NotUpgradeAuthority,
    )]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(ctx: Context<Initialize>, lock_fee: u64) -> Result<()> {
    require!(lock_fee <= MAX_LOCK_FEE, SeloError::LockFeeTooHigh);
    ctx.accounts.config.set_inner(Config {
        admin: ctx.accounts.admin.key(),
        treasury: ctx.accounts.treasury.key(),
        fee_mint: ctx.accounts.fee_mint.key(),
        lock_fee,
        paused: false,
        bump: ctx.bumps.config,
    });
    Ok(())
}
