use anchor_lang::prelude::*;

#[event]
pub struct InvoiceSealed {
    pub seal: Pubkey,
    pub invoice_hash: [u8; 32],
    pub supplier: Pubkey,
    pub buyer: Pubkey,
    pub face_amount: u64,
    pub currency: [u8; 3],
    pub due_ts: i64,
    pub timestamp: i64,
}

#[event]
pub struct InvoiceAttested {
    pub seal: Pubkey,
    pub invoice_hash: [u8; 32],
    pub buyer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct InvoiceLocked {
    pub seal: Pubkey,
    pub invoice_hash: [u8; 32],
    /// The lender's wallet (authority of its `Lender` account).
    pub lender: Pubkey,
    pub fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct InvoiceReleased {
    pub seal: Pubkey,
    pub invoice_hash: [u8; 32],
    pub lender: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct InvoiceCancelled {
    pub seal: Pubkey,
    pub invoice_hash: [u8; 32],
    pub supplier: Pubkey,
    pub timestamp: i64,
}
