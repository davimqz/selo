use anchor_lang::prelude::*;

use crate::{constants::*, error::SeloError, events::InvoiceSealed, state::*, utils::create_pda};

#[derive(Accounts)]
#[instruction(invoice_hash: [u8; 32])]
pub struct SealInvoice<'info> {
    #[account(mut)]
    pub supplier: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: `Seal` PDA, created in the handler so that an existing seal fails
    /// with `InvoiceAlreadySealed` instead of the System Program's generic
    /// "already in use". Its existence is the "only once" guarantee.
    #[account(mut, seeds = [SEAL_SEED, invoice_hash.as_ref()], bump)]
    pub seal: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_seal_invoice(
    ctx: Context<SealInvoice>,
    invoice_hash: [u8; 32],
    buyer: Pubkey,
    face_amount: u64,
    currency: [u8; 3],
    due_ts: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let seal_info = ctx.accounts.seal.to_account_info();

    require!(!ctx.accounts.config.paused, SeloError::Paused);
    require!(
        seal_info.owner != &crate::ID && seal_info.data_is_empty(),
        SeloError::InvoiceAlreadySealed
    );
    require!(face_amount > 0, SeloError::InvalidAmount);
    require!(due_ts > now, SeloError::DueDateInPast);
    require!(
        currency.iter().all(u8::is_ascii_uppercase),
        SeloError::InvalidCurrency
    );
    let supplier = ctx.accounts.supplier.key();
    require!(
        buyer != supplier && buyer != Pubkey::default(),
        SeloError::InvalidBuyer
    );

    create_pda(
        &ctx.accounts.supplier.to_account_info(),
        &seal_info,
        &ctx.accounts.system_program.key(),
        Seal::DISCRIMINATOR.len() + Seal::INIT_SPACE,
        &[SEAL_SEED, invoice_hash.as_ref(), &[ctx.bumps.seal]],
    )?;

    let seal = Seal {
        invoice_hash,
        supplier,
        buyer,
        face_amount,
        currency,
        due_ts,
        status: SealStatus::Sealed,
        buyer_attested: false,
        lender: Pubkey::default(),
        locked_at: 0,
        created_at: now,
        bump: ctx.bumps.seal,
    };
    {
        let mut data = seal_info.try_borrow_mut_data()?;
        let mut writer: &mut [u8] = &mut data;
        seal.try_serialize(&mut writer)?;
    }

    emit!(InvoiceSealed {
        seal: seal_info.key(),
        invoice_hash,
        supplier,
        buyer,
        face_amount,
        currency,
        due_ts,
        timestamp: now,
    });
    Ok(())
}
