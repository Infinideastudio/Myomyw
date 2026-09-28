//! Headless matches and multi-threaded tournaments.

use std::thread;

use crate::ai::{Agent, agent_from_spec};
use crate::ball::Side;
use crate::game::Game;
use crate::rng::Rng;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct MatchResult {
    /// `None` if `max_turns` was reached.
    pub winner: Option<Side>,
    pub turns: u32,
    pub pushes: u32,
}

/// Plays one game between two agents; the balls are drawn from `rng`.
pub fn play_match(left: &mut dyn Agent, right: &mut dyn Agent, rng: &mut Rng, max_turns: u32) -> MatchResult {
    let mut game = Game::new(rng);
    let (mut turns, mut pushes) = (0, 0);
    while !game.is_over() && turns < max_turns {
        let agent: &mut dyn Agent = if game.turn == Side::Left { &mut *left } else { &mut *right };
        agent.begin_turn(&game.view());
        let col = agent.first_push(game.next);
        let mut outcome = game.push(col, rng);
        pushes += 1;
        while outcome.result.is_none() && !outcome.turn_ended {
            if !agent.push_again(game.next) {
                game.end_turn();
                break;
            }
            outcome = game.push(col, rng);
            pushes += 1;
        }
        turns += 1;
    }
    MatchResult { winner: game.result.map(|r| r.winner), turns, pushes }
}

#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
pub struct TournamentResult {
    pub games: u32,
    pub a_wins: u32,
    pub b_wins: u32,
    pub unfinished: u32,
    /// Wins while moving first.
    pub a_first_mover_wins: u32,
    pub b_first_mover_wins: u32,
    pub turns: u64,
}

impl TournamentResult {
    fn add(&mut self, other: &TournamentResult) {
        self.games += other.games;
        self.a_wins += other.a_wins;
        self.b_wins += other.b_wins;
        self.unfinished += other.unfinished;
        self.a_first_mover_wins += other.a_first_mover_wins;
        self.b_first_mover_wins += other.b_first_mover_wins;
        self.turns += other.turns;
    }
}

/// Seeds of game `i`: (balls, agent A, agent B).
fn seeds(seed: u32, i: u32) -> (u32, u32, u32) {
    let base = u64::from(seed) * 1_000_003 + u64::from(i) * 3;
    (base as u32, (base + 1) as u32, (base + 2) as u32)
}

/// Plays `games` games between agent specs `a` and `b`, alternating sides
/// (A is Left in even games), on `threads` threads. Deterministic for a given
/// `seed`, whatever the number of threads.
pub fn tournament(a: &str, b: &str, games: u32, seed: u32, threads: usize) -> Result<TournamentResult, String> {
    agent_from_spec(a, 0)?;
    agent_from_spec(b, 0)?;
    let threads = threads.clamp(1, games.max(1) as usize);
    let partials: Vec<TournamentResult> = thread::scope(|scope| {
        let handles: Vec<_> = (0..threads)
            .map(|t| {
                scope.spawn(move || {
                    let mut result = TournamentResult::default();
                    for i in (t as u32..games).step_by(threads) {
                        let (ball_seed, a_seed, b_seed) = seeds(seed, i);
                        let mut agent_a = agent_from_spec(a, a_seed).expect("validated");
                        let mut agent_b = agent_from_spec(b, b_seed).expect("validated");
                        let a_is_left = i % 2 == 0;
                        let mut rng = Rng::new(ball_seed);
                        let outcome = if a_is_left {
                            play_match(agent_a.as_mut(), agent_b.as_mut(), &mut rng, 10_000)
                        } else {
                            play_match(agent_b.as_mut(), agent_a.as_mut(), &mut rng, 10_000)
                        };
                        result.games += 1;
                        result.turns += u64::from(outcome.turns);
                        match outcome.winner {
                            None => result.unfinished += 1,
                            Some(winner) => {
                                let a_won = (winner == Side::Left) == a_is_left;
                                let first = winner == Side::Left;
                                if a_won {
                                    result.a_wins += 1;
                                    result.a_first_mover_wins += u32::from(first);
                                } else {
                                    result.b_wins += 1;
                                    result.b_first_mover_wins += u32::from(first);
                                }
                            }
                        }
                    }
                    result
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().expect("tournament thread panicked")).collect()
    });
    let mut total = TournamentResult::default();
    partials.iter().for_each(|p| total.add(p));
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tournaments_do_not_depend_on_the_thread_count() {
        let one = tournament("normal", "easy", 40, 5, 1).unwrap();
        let many = tournament("normal", "easy", 40, 5, 7).unwrap();
        assert_eq!(one, many);
        assert_eq!(one.a_wins + one.b_wins + one.unfinished, 40);
    }
}
