use anchor_lang::prelude::*;

#[event]
pub struct DealCreated {
    pub deal: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub required_milestones: u8,
    pub expires_at: i64,
    pub payment_due_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowFunded {
    pub deal: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct DocumentRegistered {
    pub deal: Pubkey,
    pub document: Pubkey,
    pub doc_hash: [u8; 32],
    pub doc_type: u8,
    pub timestamp: i64,
}

#[event]
pub struct MilestoneAttested {
    pub deal: Pubkey,
    pub milestone: u8,
    pub attester: Pubkey,
    pub evidence_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct AdvanceFunded {
    pub deal: Pubkey,
    pub financier: Pubkey,
    pub amount: u64,
    pub repay_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct DealSettled {
    pub deal: Pubkey,
    pub to_financier: u64,
    pub to_seller: u64,
    pub timestamp: i64,
}

#[event]
pub struct DealRefunded {
    pub deal: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct DealCancelled {
    pub deal: Pubkey,
    pub by: Pubkey,
    pub timestamp: i64,
}
