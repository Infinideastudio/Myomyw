use crate::ball::{Ball, MAX_PUSHES, Side};
use crate::board::Board;
use crate::rng::Rng;

use super::Agent;
use super::search::{INF, LOSS, PoolSearch};

/// "Normal" (`max_depth = 1`) and "Hard" (`max_depth = 2`): alpha-beta search
/// averaged over `fillout` random sequences of upcoming balls. Port of
/// `StrongAI` in `@myomyw/core`; with the same seed it makes the same moves.
pub struct StrongAi {
    max_depth: u32,
    fillout: u32,
    rng: Rng,
    searcher: PoolSearch,
    root: Board,
    moved: usize,
    current_col: usize,
}

impl StrongAi {
    pub fn new(max_depth: u32, fillout: u32, seed: u32) -> StrongAi {
        StrongAi {
            max_depth,
            fillout,
            rng: Rng::new(seed),
            searcher: PoolSearch::default(),
            root: Board::initial(),
            moved: 0,
            current_col: 0,
        }
    }

    /// Starts a new sample: the real next ball followed by `size − 1` random ones.
    fn sample(&mut self, next: Ball, size: usize) {
        let pool = &mut self.searcher.pool;
        pool.clear();
        pool.push(next);
        for _ in 1..size {
            pool.push(self.rng.ball());
        }
    }
}

impl Agent for StrongAi {
    fn name(&self) -> String {
        format!("StrongAI(maxDepth:{},fillout:{})", self.max_depth, self.fillout)
    }

    fn begin_turn(&mut self, view: &Board) {
        self.root = *view;
    }

    fn first_push(&mut self, next: Ball) -> usize {
        let mut col_value = vec![0i32; self.root.l_col()];
        for _ in 0..self.fillout {
            self.sample(next, self.max_depth as usize * MAX_PUSHES);
            for (col, value) in col_value.iter_mut().enumerate() {
                *value += self.searcher.search_col(&self.root, self.max_depth, -INF, INF, Side::Left, 0, col);
            }
        }
        let best = argmax(&col_value);
        self.root.push(Side::Left, best, next);
        self.moved = 1;
        self.current_col = best;
        best
    }

    fn push_again(&mut self, next: Ball) -> bool {
        let maxmove = MAX_PUSHES - self.moved;
        if maxmove == 0 {
            return false;
        }
        let depth = self.max_depth.saturating_sub(1).max(1);
        let mut value = vec![0i32; maxmove + 1];
        for _ in 0..self.fillout {
            self.sample(next, depth as usize * MAX_PUSHES + maxmove);
            value[0] -= self.searcher.search(&self.root, depth, -INF, INF, Side::Right, 0);
            let mut node = self.root;
            for m in 1..=maxmove {
                let last = node.push(Side::Left, self.current_col, self.searcher.pool[m - 1]);
                let v = if last == Ball::Key { LOSS } else { -self.searcher.search(&node, depth, -INF, INF, Side::Right, m) };
                if last == Ball::Key || last == Ball::Flip {
                    // Longer plans lose too (Key) or are the same plan (the Flip ended the turn).
                    value[m..].iter_mut().for_each(|x| *x += v);
                    break;
                }
                value[m] += v;
            }
        }
        let again = argmax(&value) != 0;
        if again {
            self.root.push(Side::Left, self.current_col, next);
            self.moved += 1;
        }
        again
    }
}

/// Index of the largest value (the first one on ties).
fn argmax(values: &[i32]) -> usize {
    let mut best = 0;
    for (i, &v) in values.iter().enumerate().skip(1) {
        if v > values[best] {
            best = i;
        }
    }
    best
}
