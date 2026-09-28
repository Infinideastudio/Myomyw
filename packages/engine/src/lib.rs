//! Fast Myomyw engine: rules, AI players and tournaments.
//!
//! This crate is the performance-oriented counterpart of `@myomyw/core`. It
//! implements the same rules (checked against the TypeScript engine by
//! `packages/engine/test/`) with a bitboard representation, and the same AI
//! players, making the same decisions for the same seeds. It builds natively
//! (tournaments, benchmarks, future training) and to WebAssembly for the
//! browser (see `ffi` and `js/index.ts`).
//!
//! The main types map onto the Markov game of docs/rules.md §9:
//! [`Game`] is a state, [`Action`] an action, and [`Game::apply`] with an
//! [`Rng`] samples the transition.

pub mod ai;
pub mod arena;
mod ball;
mod board;
pub mod ffi;
mod game;
mod rng;

pub use ball::{Ball, INITIAL_COLS, MAX_COLS, MAX_PUSHES, MIN_COLS, Side};
pub use board::Board;
pub use game::{Action, Actions, EndReason, Game, GameResult, PushOutcome};
pub use rng::Rng;
