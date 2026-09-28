//! Computer players. See docs/ai.md.

mod search;
mod strong;
mod weak;

pub use search::{INF, LOSS, PoolSearch};
pub use strong::StrongAi;
pub use weak::WeakAi;

use crate::ball::Ball;
use crate::board::Board;

/// A computer player; the same protocol as `Agent` in `@myomyw/core`.
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
}

/// The built-in opponents.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Difficulty {
    Easy,
    Normal,
    Hard,
}

/// Creates a built-in opponent, identical to `createAgent(difficulty, seededRng(seed))`.
pub fn create_agent(difficulty: Difficulty, seed: u32) -> Box<dyn Agent> {
    match difficulty {
        Difficulty::Easy => Box::new(WeakAi::new()),
        Difficulty::Normal => Box::new(StrongAi::new(1, 10, seed)),
        Difficulty::Hard => Box::new(StrongAi::new(2, 10, seed)),
    }
}

/// Parses an agent spec: `easy`, `normal`, `hard` or `strong:<maxDepth>,<fillout>`
/// (the same specs as `agentFromSpec` in `@myomyw/core`).
pub fn agent_from_spec(spec: &str, seed: u32) -> Result<Box<dyn Agent>, String> {
    match spec {
        "easy" => Ok(create_agent(Difficulty::Easy, seed)),
        "normal" => Ok(create_agent(Difficulty::Normal, seed)),
        "hard" => Ok(create_agent(Difficulty::Hard, seed)),
        _ => {
            let parse = || -> Option<Box<dyn Agent>> {
                let (depth, fillout) = spec.strip_prefix("strong:")?.split_once(',')?;
                Some(Box::new(StrongAi::new(depth.parse().ok()?, fillout.parse().ok()?, seed)))
            };
            parse().ok_or_else(|| format!("unknown agent \"{spec}\""))
        }
    }
}
