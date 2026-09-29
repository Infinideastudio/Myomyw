//! Computer players. See docs/ai.md.

mod mcts;
mod search;
mod strong;
pub mod value;
mod weak;

pub use mcts::{IMPOSSIBLE_ITERS, Leaf, Mcts, MctsAi, MctsParams};
pub use search::{INF, LOSS, PoolSearch};
pub use strong::StrongAi;
pub use weak::WeakAi;

use crate::ball::Ball;
use crate::board::Board;

/// A computer player (see docs/ai.md). `WasmAgent` exposes the same protocol to TypeScript.
///
/// Agents always play as Left: the host passes `game.view()` (the board
/// flipped when the agent plays Right). Per turn the host calls `begin_turn`,
/// then `first_push(next)` and pushes the returned line inserting `next`,
/// then — while the turn can continue — `push_again(next)` with the new next
/// ball, pushing again while it returns `true`.
pub trait Agent: Send {
    fn name(&self) -> String;
    fn begin_turn(&mut self, view: &Board);
    fn first_push(&mut self, next: Ball) -> usize;
    fn push_again(&mut self, next: Ball) -> bool;
    /// The agent's estimate, as of its latest decision, of its probability of
    /// winning, if it computes one.
    fn win_estimate(&self) -> Option<f32> {
        None
    }
}

/// The built-in opponents.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Difficulty {
    Easy,
    Normal,
    Hard,
    Impossible,
}

/// Creates a built-in opponent; the same seed always gives the same play.
pub fn create_agent(difficulty: Difficulty, seed: u32) -> Box<dyn Agent> {
    match difficulty {
        Difficulty::Easy => Box::new(WeakAi::new()),
        Difficulty::Normal => Box::new(StrongAi::new(1, 10, seed)),
        Difficulty::Hard => Box::new(StrongAi::new(2, 10, seed)),
        Difficulty::Impossible => Box::new(MctsAi::new(MctsParams::default(), seed)),
    }
}

/// Parses an agent spec: `easy`, `normal`, `hard`, `impossible`,
/// `strong:<maxDepth>,<fillout>` or `mcts[:<key>=<value>,…]` (see [`MctsParams::parse`]).
/// `Engine.createAgent` in TypeScript accepts all of them, with only the
/// `iters` and `puct` options of `mcts`.
pub fn agent_from_spec(spec: &str, seed: u32) -> Result<Box<dyn Agent>, String> {
    match spec {
        "easy" => Ok(create_agent(Difficulty::Easy, seed)),
        "normal" => Ok(create_agent(Difficulty::Normal, seed)),
        "hard" => Ok(create_agent(Difficulty::Hard, seed)),
        "impossible" => Ok(create_agent(Difficulty::Impossible, seed)),
        "mcts" => Ok(Box::new(MctsAi::new(MctsParams::default(), seed))),
        _ if spec.starts_with("mcts:") => Ok(Box::new(MctsAi::new(MctsParams::parse(&spec[5..])?, seed))),
        _ => {
            let parse = || -> Option<Box<dyn Agent>> {
                let (depth, fillout) = spec.strip_prefix("strong:")?.split_once(',')?;
                Some(Box::new(StrongAi::new(depth.parse().ok()?, fillout.parse().ok()?, seed)))
            };
            parse().ok_or_else(|| format!("unknown agent \"{spec}\""))
        }
    }
}
