use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::BuyerVerified, state::*};

/// The admin acts as the KYB verifier: it registers a company's wallet after
/// checking off-chain that the wallet belongs to the holder of that tax ID.
#[derive(Accounts)]
#[instruction(tax_id_hash: [u8; 32])]
pub struct RegisterBuyer<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    /// CHECK: any wallet or multisig vault; it becomes the buyer's authority.
    pub buyer_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Buyer::INIT_SPACE,
        seeds = [BUYER_SEED, tax_id_hash.as_ref()],
        bump,
    )]
    pub buyer_record: Account<'info, Buyer>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_buyer(
    ctx: Context<RegisterBuyer>,
    tax_id_hash: [u8; 32],
    name: String,
) -> Result<()> {
    require!(
        !name.trim().is_empty() && name.len() <= MAX_BUYER_NAME_LEN,
        SeloError::InvalidBuyerName
    );
    let authority = ctx.accounts.buyer_authority.key();
    require!(authority != Pubkey::default(), SeloError::InvalidBuyer);
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.buyer_record.set_inner(Buyer {
        authority,
        tax_id_hash,
        name,
        active: true,
        verified_at: now,
        bump: ctx.bumps.buyer_record,
    });

    emit!(BuyerVerified {
        buyer: ctx.accounts.buyer_record.key(),
        authority,
        tax_id_hash,
        timestamp: now,
    });
    Ok(())
}
