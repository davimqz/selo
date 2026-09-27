//! PDA seeds, milestone bits, document types and protocol limits.

pub const DEAL_SEED: &[u8] = b"deal";
pub const VAULT_SEED: &[u8] = b"vault";
pub const DOC_SEED: &[u8] = b"doc";
pub const MILESTONE_SEED: &[u8] = b"milestone";

pub const INSPECTED: u8 = 1 << 0;
pub const SHIPPED: u8 = 1 << 1;
pub const EUDR_COMPLIANT: u8 = 1 << 2;
pub const DELIVERED: u8 = 1 << 3;
pub const ALL_MILESTONES: u8 = INSPECTED | SHIPPED | EUDR_COMPLIANT | DELIVERED;

pub const DOC_BILL_OF_LADING: u8 = 0;
pub const DOC_COMMERCIAL_INVOICE: u8 = 1;
pub const DOC_CPR: u8 = 2;
pub const DOC_TYPE_COUNT: u8 = 3;

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_ATTESTERS: usize = 4;

pub const ATTESTER_MODE_ALLOWLIST: u8 = 0;
