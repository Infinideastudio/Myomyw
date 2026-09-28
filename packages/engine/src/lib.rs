//! Fast Myomyw engine: rules, AI players and tournaments.
//!
//! The single implementation of the game: rules (with a bitboard
//! representation; checked against the original game's code by
//! `packages/engine/test/`) and AI players. It builds natively (tournaments,
//! benchmarks, training) and to WebAssembly, used by the web client and the
//! server (see `ffi` and `js/index.ts`).
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
