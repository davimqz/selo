use anchor_lang::prelude::*;

#[error_code]
pub enum SeloError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Advance cap and fee would let repayment exceed the escrow amount")]
    InvalidBps,
    #[msg("Schedule must satisfy now < expires_at <= payment_due_at")]
    InvalidSchedule,
    #[msg("Milestone must be a single known milestone bit")]
    InvalidMilestone,
    #[msg("SHIPPED must be a required milestone")]
    ShippedNotRequired,
    #[msg("Milestone is not required by this deal")]
    MilestoneNotRequired,
    #[msg("Attesters must be 1 to 4 distinct keys, each with a non-empty known milestone mask")]
    InvalidAttesters,
    #[msg("Seller and buyer must be different accounts")]
    InvalidParties,
    #[msg("Signer is not authorized to attest this milestone")]
    UnauthorizedAttester,
    #[msg("Latest shipment date has passed")]
    ShipmentDeadlinePassed,
    #[msg("Shipment (SHIPPED) has not been attested")]
    NotShipped,
    #[msg("Unknown document type")]
    InvalidDocumentType,
    #[msg("This document is already registered: it cannot be pledged twice")]
    DocumentAlreadyRegistered,
    #[msg("A document of this type is already registered on this deal")]
    DocumentTypeAlreadyOnDeal,
    #[msg("Document is not this deal's bill of lading")]
    BillOfLadingMismatch,
    #[msg("Advance exceeds the deal's maximum advance")]
    AdvanceExceedsLimit,
    #[msg("Financier cannot be the seller or the buyer")]
    FinancierIsParty,
    #[msg("Not all required milestones have been attested")]
    MissingMilestones,
    #[msg("Payment is not due yet")]
    PaymentNotDue,
    #[msg("Payment is already due; advances are closed")]
    PaymentDue,
    #[msg("Deal has expired")]
    DealExpired,
    #[msg("Deal has not expired yet")]
    DealNotExpired,
    #[msg("Shipment was attested: no on-chain refund")]
    AlreadyShipped,
    #[msg("Deal is not in a valid status for this action")]
    InvalidStatus,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
