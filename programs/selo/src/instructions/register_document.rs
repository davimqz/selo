use anchor_lang::{
    prelude::*,
    system_program::{self, Allocate, Assign, Transfer},
};

use crate::{constants::*, error::SeloError, events::DocumentRegistered, state::*};

#[derive(Accounts)]
#[instruction(doc_hash: [u8; 32])]
pub struct RegisterDocument<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        seeds = [DEAL_SEED, deal.seller.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
        has_one = seller,
    )]
    pub deal: Account<'info, Deal>,
    /// CHECK: `DocumentRecord` PDA. Created manually in the handler so that an
    /// existing record fails with `DocumentAlreadyRegistered` instead of the
    /// System Program's generic "already in use".
    #[account(mut, seeds = [DOC_SEED, doc_hash.as_ref()], bump)]
    pub doc_record: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_document(
    ctx: Context<RegisterDocument>,
    doc_hash: [u8; 32],
    doc_type: u8,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let doc_info = ctx.accounts.doc_record.to_account_info();

    // The existence of this PDA is the anti-double-pledge lock.
    require!(
        doc_info.owner != &crate::ID && doc_info.data_is_empty(),
        SeloError::DocumentAlreadyRegistered
    );

    let deal = &ctx.accounts.deal;
    require!(deal.status == DealStatus::Funded, SeloError::InvalidStatus);
    require!(doc_type < DOC_TYPE_COUNT, SeloError::InvalidDocumentType);
    let type_bit = 1u8 << doc_type;
    require!(
        deal.documents & type_bit == 0,
        SeloError::DocumentTypeAlreadyOnDeal
    );

    create_pda(
        &ctx.accounts.seller.to_account_info(),
        &doc_info,
        &ctx.accounts.system_program.key(),
        DocumentRecord::DISCRIMINATOR.len() + DocumentRecord::INIT_SPACE,
        &[DOC_SEED, doc_hash.as_ref(), &[ctx.bumps.doc_record]],
    )?;

    let record = DocumentRecord {
        doc_hash,
        doc_type,
        deal: deal.key(),
        registered_by: ctx.accounts.seller.key(),
        registered_at: now,
        bump: ctx.bumps.doc_record,
    };
    {
        let mut data = doc_info.try_borrow_mut_data()?;
        let mut writer: &mut [u8] = &mut data;
        record.try_serialize(&mut writer)?;
    }

    let deal = &mut ctx.accounts.deal;
    deal.documents |= type_bit;
    if doc_type == DOC_BILL_OF_LADING {
        deal.bill_of_lading = doc_info.key();
    }

    emit!(DocumentRegistered {
        deal: deal.key(),
        document: doc_info.key(),
        doc_hash,
        doc_type,
        timestamp: now,
    });
    Ok(())
}

/// Creates a program-owned PDA even if someone pre-funded it with lamports
/// (transfer + allocate + assign instead of `create_account`).
fn create_pda<'info>(
    payer: &AccountInfo<'info>,
    pda: &AccountInfo<'info>,
    system_program: &Pubkey,
    space: usize,
    seeds: &[&[u8]],
) -> Result<()> {
    let rent = Rent::get()?.minimum_balance(space);
    let missing = rent.saturating_sub(pda.lamports());
    if missing > 0 {
        system_program::transfer(
            CpiContext::new(
                *system_program,
                Transfer {
                    from: payer.clone(),
                    to: pda.clone(),
                },
            ),
            missing,
        )?;
    }
    let signer: &[&[&[u8]]] = &[seeds];
    system_program::allocate(
        CpiContext::new_with_signer(
            *system_program,
            Allocate {
                account_to_allocate: pda.clone(),
            },
            signer,
        ),
        space as u64,
    )?;
    system_program::assign(
        CpiContext::new_with_signer(
            *system_program,
            Assign {
                account_to_assign: pda.clone(),
            },
            signer,
        ),
        &crate::ID,
    )?;
    Ok(())
}
