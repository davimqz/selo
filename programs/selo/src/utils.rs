use anchor_lang::{
    prelude::*,
    system_program::{self, Allocate, Assign, Transfer},
};

/// Creates a program-owned PDA even if someone pre-funded it with lamports
/// (transfer + allocate + assign instead of `create_account`).
pub fn create_pda<'info>(
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
