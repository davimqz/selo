//! Selo — programmable letter of credit on Solana.
//!
//! Phase 0 skeleton: modules and program ID only. Instructions are added in
//! Phase 1 following `docs/plan.md`.

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;

declare_id!("4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio");

#[program]
pub mod selo {}
