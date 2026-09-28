use crate::ball::{Ball, MAX_PUSHES, Side};
use crate::board::Board;

/// Value, for the side that did it, of pushing the Key ball off the board.
pub const LOSS: i32 = -10_000;
/// Search window bound; larger than any real value and safe to negate.
pub const INF: i32 = 1 << 30;

/// Negamax search with alpha-beta pruning for one fixed sequence of upcoming
/// balls (`pool`). A move is a whole turn: choose a line, push it 1–5 times.
/// Every push, by either side, consumes the next ball of the pool.
/// Port of `PoolSearch` in `@myomyw/core`.
#[derive(Clone, Debug, Default)]
pub struct PoolSearch {
    /// Upcoming balls: `pool[0]` is inserted by the next push, and so on.
    pub pool: Vec<Ball>,
}

impl PoolSearch {
    /// Value of `node` for `side` to move, looking `depth` turns ahead.
    pub fn search(&self, node: &Board, depth: u32, alpha: i32, beta: i32, side: Side, poolptr: usize) -> i32 {
        if depth == 0 {
            return match side {
                Side::Left => node.evaluate(),
                Side::Right => -node.evaluate(),
            };
        }
        let mut best = -INF;
        for col in 0..node.ejectors(side) {
            best = best.max(self.search_col(node, depth, best.max(alpha), beta, side, poolptr, col));
            if best >= beta {
                break;
            }
        }
        best
    }

    /// Best value for `side` among pushing line `col` 1..5 times, then passing the turn.
    #[allow(clippy::too_many_arguments)]
    pub fn search_col(&self, node: &Board, depth: u32, alpha: i32, beta: i32, side: Side, mut poolptr: usize, col: usize) -> i32 {
        let mut best = -INF;
        let mut child = *node;
        for _ in 0..MAX_PUSHES {
            let last = child.push(side, col, self.pool[poolptr]);
            poolptr += 1;
            let val =
                if last == Ball::Key { LOSS } else { -self.search(&child, depth - 1, -beta, -best.max(alpha), side.opponent(), poolptr) };
            best = best.max(val);
            if best >= beta || last == Ball::Flip || last == Ball::Key {
                break;
            }
        }
        best
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;

    /// Plain negamax without pruning.
    fn negamax(pool: &[Ball], node: &Board, depth: u32, side: Side, ptr: usize) -> i32 {
        if depth == 0 {
            return if side == Side::Left { node.evaluate() } else { -node.evaluate() };
        }
        let mut best = -INF;
        for col in 0..node.ejectors(side) {
            let mut child = *node;
            let mut p = ptr;
            for _ in 0..MAX_PUSHES {
                let last = child.push(side, col, pool[p]);
                p += 1;
                best = best.max(if last == Ball::Key { LOSS } else { -negamax(pool, &child, depth - 1, side.opponent(), p) });
                if last == Ball::Key || last == Ball::Flip {
                    break;
                }
            }
        }
        best
    }

    #[test]
    fn alpha_beta_is_exact() {
        let mut rng = Rng::new(2024);
        for n in 0..60 {
            let mut board = Board::filled_common(3 + rng.below(8) as usize, 3 + rng.below(8) as usize);
            for l in 0..board.l_col() {
                for r in 0..board.r_col() {
                    if rng.below(2) == 0 {
                        board.set(l, r, rng.ball());
                    }
                }
            }
            let search = PoolSearch { pool: (0..10).map(|_| rng.ball()).collect() };
            let side = if n % 2 == 0 { Side::Left } else { Side::Right };
            let depth = if n % 3 == 0 { 2 } else { 1 };
            assert_eq!(search.search(&board, depth, -INF, INF, side, 0), negamax(&search.pool, &board, depth, side, 0));
        }
    }
}
