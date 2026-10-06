use anchor_lang::prelude::*;

#[error_code]
pub enum SeloError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Invoice is not in a valid status for this action")]
    InvalidStatus,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Signer is not the program's upgrade authority")]
    NotUpgradeAuthority,
    #[msg("Lock fee exceeds the maximum")]
    LockFeeTooHigh,
    #[msg("Fee mint must have 6 decimals")]
    InvalidFeeMint,
    #[msg("Lender name must be 1 to 32 bytes and not blank")]
    InvalidLenderName,
    #[msg("Registry is paused")]
    Paused,
    #[msg("This invoice is already sealed: it cannot be registered twice")]
    InvoiceAlreadySealed,
    #[msg("Due date must be in the future")]
    DueDateInPast,
    #[msg("Currency must be a 3-letter ISO 4217 code")]
    InvalidCurrency,
    #[msg("Buyer must be a different, non-default account")]
    InvalidBuyer,
    #[msg("This invoice is already financed: another lender has locked it")]
    InvoiceAlreadyLocked,
    #[msg("The buyer has not attested this invoice")]
    NotAttested,
    #[msg("The buyer has already attested this invoice")]
    AlreadyAttested,
    #[msg("Lender is not active")]
    LenderInactive,
    #[msg("Only the lender that locked the invoice can release it")]
    NotLockHolder,
}
