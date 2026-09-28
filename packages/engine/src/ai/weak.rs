use crate::ball::{Ball, MAX_PUSHES, Side};
use crate::board::Board;

use super::Agent;

/// "Easy": a one-shot heuristic with no search. Port of `WeakAI` in
/// `@myomyw/core` (same floating-point arithmetic, so the same moves).
pub struct WeakAi {
    board: Board,
    best_col: usize,
    remaining: usize,
}

impl WeakAi {
    pub fn new() -> WeakAi {
        WeakAi { board: Board::initial(), best_col: 0, remaining: 0 }
    }

    fn ball_value(view: &Board, ball: Ball, r: usize) -> f64 {
        match ball {
            Ball::Common => 1.0,
            Ball::Key if r == view.r_col() - 1 => -10.0,
            Ball::Key => -3.0,
            Ball::AddCol => -1.0,
            Ball::DelCol => 2.0,
            Ball::Flip if view.r_col() > view.l_col() => 1.0,
            Ball::Flip => -1.0,
        }
    }

    fn push_once(&mut self, next: Ball) {
        self.remaining -= 1;
        if self.board.push(Side::Left, self.best_col, next) == Ball::Flip {
            self.remaining = 0;
        }
    }
}

impl Default for WeakAi {
    fn default() -> WeakAi {
        WeakAi::new()
    }
}

impl Agent for WeakAi {
    fn name(&self) -> String {
        "WeakAI".to_string()
    }

    fn begin_turn(&mut self, view: &Board) {
        self.board = *view;
        let r_col = view.r_col();
        let mut max_weighting = f64::NEG_INFINITY;
        self.best_col = 0;
        for l in 0..view.l_col() {
            let mut weighting = 0.0;
            for r in 0..r_col {
                weighting += Self::ball_value(view, view.get(l, r), r) * ((r + 1) as f64 / r_col as f64);
            }
            if weighting > max_weighting {
                max_weighting = weighting;
                self.best_col = l;
            }
        }
        // JavaScript's Math.round rounds halves up; only positive values matter after clamping.
        let times = (max_weighting + 0.5).floor();
        self.remaining = times.clamp(1.0, MAX_PUSHES as f64) as usize;
    }

    fn first_push(&mut self, next: Ball) -> usize {
        self.push_once(next);
        self.best_col
    }

    fn push_again(&mut self, next: Ball) -> bool {
        if self.remaining == 0 {
            return false;
        }
        self.push_once(next);
        true
    }
}
