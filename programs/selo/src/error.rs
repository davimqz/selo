use anchor_lang::prelude::*;

#[error_code]
pub enum SeloError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Invoice is not in a valid status for this action")]
    InvalidStatus,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
