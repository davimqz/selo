use anchor_lang::prelude::*;

use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, PartialEq, Eq, InitSpace, Debug)]
pub struct AttesterEntry {
    pub key: Pubkey,
    /// Milestone bits this attester may sign.
    pub milestones: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DealStatus {
    Created,
    Funded,
    Advanced,
    Settled,
    Refunded,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Deal {
    pub deal_id: u64,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub usdc_mint: Pubkey,
    pub amount: u64,
    pub max_advance_bps: u16,
    pub advance_fee_bps: u16,
    pub required_milestones: u8,
    pub attested_milestones: u8,
    /// Bitmask of registered document types (`1 << doc_type`).
    pub documents: u8,
    /// The bill of lading `DocumentRecord`, or default if none.
    pub bill_of_lading: Pubkey,
    pub attester_mode: u8,
    pub attesters: [AttesterEntry; MAX_ATTESTERS],
    /// Reserved for Phase 2 (SAS).
    pub sas_credential: Pubkey,
    /// Reserved for Phase 2 (SAS).
    pub sas_schema: Pubkey,
    pub financier: Pubkey,
    pub advanced_amount: u64,
    pub repay_amount: u64,
    pub status: DealStatus,
    pub created_at: i64,
    /// Latest shipment date: SHIPPED must be attested by then.
    pub expires_at: i64,
    /// Usance maturity: settlement allowed from this time on.
    pub payment_due_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Deal {
    pub fn has_milestone(&self, milestone: u8) -> bool {
        self.attested_milestones & milestone == milestone
    }

    /// Whether `signer` may attest `milestone` under the allowlist policy.
    /// The buyer may always attest DELIVERED, but is never the only path.
    pub fn allowlist_authorizes(&self, signer: &Pubkey, milestone: u8) -> bool {
        if milestone == DELIVERED && *signer == self.buyer {
            return true;
        }
        self.attesters.iter().any(|a| {
            a.key != Pubkey::default() && a.key == *signer && a.milestones & milestone != 0
        })
    }

    pub fn max_advance(&self) -> Option<u64> {
        let cap = (self.amount as u128)
            .checked_mul(self.max_advance_bps as u128)?
            .checked_div(BPS_DENOMINATOR as u128)?;
        u64::try_from(cap).ok()
    }
}

#[account]
#[derive(InitSpace)]
pub struct DocumentRecord {
    pub doc_hash: [u8; 32],
    pub doc_type: u8,
    pub deal: Pubkey,
    pub registered_by: Pubkey,
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MilestoneRecord {
    pub deal: Pubkey,
    pub milestone: u8,
    pub attester: Pubkey,
    pub evidence_hash: [u8; 32],
    /// Reserved for Phase 2 (SAS).
    pub sas_attestation: Pubkey,
    pub attested_at: i64,
    pub bump: u8,
}

pub fn is_single_known_milestone(milestone: u8) -> bool {
    milestone != 0 && milestone & !ALL_MILESTONES == 0 && milestone.is_power_of_two()
}
