//! Selo — a public, neutral registry that blocks financing the same invoice twice.
//!
//! Each invoice becomes a PDA derived from the hash of its canonical fields:
//! sealing it again fails, and only one lender can lock it. See `CLAUDE.md`.

pub mod error;

use anchor_lang::prelude::*;

declare_id!("4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio");

#[program]
pub mod selo {}
