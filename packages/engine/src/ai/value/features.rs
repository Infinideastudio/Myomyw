//! Input features of the value network, always from the point of view of the
//! player to move (who is made Left by flipping the board).
//!
//! Cells are indexed from the bottom corner: `dl = l_col − 1 − l` is how far
//! the cell is from falling off Right's lines, `dr = r_col − 1 − r` from
//! falling off the mover's lines, so a feature keeps its meaning when lines
//! are added or removed.

use crate::ball::{Ball, MAX_COLS, MIN_COLS, Side};
use crate::board::Board;
use crate::game::Game;

const CELLS: usize = 0; // 4 kinds × 10 × 10
const L_COL: usize = CELLS + 400; // 8
const R_COL: usize = L_COL + 8; // 8
const NEXT: usize = R_COL + 8; // 5
const PUSHES: usize = NEXT + 5; // 5
const CUR_ROW: usize = PUSHES + 5; // 4 kinds × 10 (dr) in the line pushed this turn
const CUR_DL: usize = CUR_ROW + 40; // 10
const MY_SAFE: usize = CUR_DL + 10; // 11: my lines by number of safe pushes (10 = no Key)
const OPP_SAFE: usize = MY_SAFE + 11; // 11
const EVAL: usize = OPP_SAFE + 11; // 1: the classic static evaluation
pub const N_FEATURES: usize = EVAL + 1;

/// Maximum number of active features of one position.
pub const MAX_ACTIVE: usize = 100 + 4 + 10 + 2 + 2 + 11 + 11 + 1 + 8;

/// Active features as (index, value) pairs.
#[derive(Clone, Copy)]
pub struct Features {
    pub idx: [u16; MAX_ACTIVE],
    pub val: [f32; MAX_ACTIVE],
    pub len: usize,
}

impl Features {
    #[inline]
    fn add(&mut self, i: usize, v: f32) {
        self.idx[self.len] = i as u16;
        self.val[self.len] = v;
        self.len += 1;
    }
}

/// Kind index 0–3 of a special ball.
#[inline]
fn kind(ball: Ball) -> usize {
    ball as usize - 1
}

/// Features of `game` for the player to move. `game` must not be over.
pub fn extract(game: &Game) -> Features {
    let board = game.board.view_for(game.turn);
    extract_view(&board, game.next, game.pushes, game.column)
}

/// Features of a position seen by the mover as Left.
pub fn extract_view(board: &Board, next: Ball, pushes: u8, column: Option<u8>) -> Features {
    let mut f = Features { idx: [0; MAX_ACTIVE], val: [0.0; MAX_ACTIVE], len: 0 };
    let (l_col, r_col) = (board.l_col(), board.r_col());
    let mut row_top = [-1i32; MAX_COLS];
    let mut col_top = [-1i32; MAX_COLS];
    let cur = column.map(|c| c as usize);
    board.for_each_special(|l, r, ball| {
        let (dl, dr) = (l_col - 1 - l, r_col - 1 - r);
        f.add(CELLS + kind(ball) * 100 + dl * 10 + dr, 1.0);
        if cur == Some(l) {
            f.add(CUR_ROW + kind(ball) * 10 + dr, 1.0);
        }
        if ball == Ball::Key {
            row_top[l] = row_top[l].max(r as i32);
            col_top[r] = col_top[r].max(l as i32);
        }
    });
    f.add(L_COL + l_col - MIN_COLS, 1.0);
    f.add(R_COL + r_col - MIN_COLS, 1.0);
    f.add(NEXT + next as usize, 1.0);
    f.add(PUSHES + pushes as usize, 1.0);
    if let Some(c) = cur {
        f.add(CUR_DL + l_col - 1 - c, 1.0);
    }
    let bin = |top: i32, len: usize| if top < 0 { 10 } else { len - 1 - top as usize };
    let mut mine = [0u8; 11];
    let mut theirs = [0u8; 11];
    for &top in &row_top[..l_col] {
        mine[bin(top, r_col)] += 1;
    }
    for &top in &col_top[..r_col] {
        theirs[bin(top, l_col)] += 1;
    }
    for i in 0..11 {
        if mine[i] > 0 {
            f.add(MY_SAFE + i, f32::from(mine[i]) * 0.25);
        }
        if theirs[i] > 0 {
            f.add(OPP_SAFE + i, f32::from(theirs[i]) * 0.25);
        }
    }
    f.add(EVAL, board.evaluate() as f32 * 0.05);
    f
}

/// A mover-as-Left position packed into 64 bytes, with a training target.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Sample {
    pub board: Board,
    pub next: Ball,
    pub pushes: u8,
    pub column: Option<u8>,
    /// Final result for the mover: 1 (won) or −1 (lost).
    pub target: f32,
    /// The search's value estimate for the mover, in [−1, 1] (0 if unknown).
    pub search: f32,
    /// The real side to move (the board above is always seen as Left).
    pub mover: Side,
    /// First position of a game (samples of a game are stored consecutively).
    pub start: bool,
}

pub const SAMPLE_BYTES: usize = 64;

impl Sample {
    /// `game` from its mover's point of view.
    pub fn from_game(game: &Game, target: f32, search: f32) -> Sample {
        Sample {
            board: game.board.view_for(game.turn),
            next: game.next,
            pushes: game.pushes,
            column: game.column,
            target,
            search,
            mover: game.turn,
            start: false,
        }
    }

    pub fn game(&self) -> Game {
        let mut g = Game::from_position(self.board, Side::Left, self.next);
        g.pushes = self.pushes;
        g.column = self.column;
        g
    }

    pub fn features(&self) -> Features {
        extract_view(&self.board, self.next, self.pushes, self.column)
    }

    pub fn to_bytes(&self) -> [u8; SAMPLE_BYTES] {
        let mut out = [0u8; SAMPLE_BYTES];
        out[0] = self.board.l_col() as u8;
        out[1] = self.board.r_col() as u8;
        out[2] = self.next as u8;
        out[3] = self.pushes;
        out[4] = self.column.unwrap_or(0xff);
        out[5..9].copy_from_slice(&self.target.to_le_bytes());
        let cells = self.board.to_cells();
        for (i, pair) in cells.chunks(2).enumerate() {
            out[9 + i] = pair[0] | pair[1] << 4;
        }
        out[59..63].copy_from_slice(&self.search.to_le_bytes());
        out[63] = self.mover as u8 | u8::from(self.start) << 1;
        out
    }

    pub fn from_bytes(b: &[u8]) -> Option<Sample> {
        let mut cells = [0u8; 100];
        for i in 0..50 {
            cells[2 * i] = b[9 + i] & 15;
            cells[2 * i + 1] = b[9 + i] >> 4;
        }
        Some(Sample {
            board: Board::from_cells(b[0] as usize, b[1] as usize, &cells)?,
            next: Ball::from_u8(b[2])?,
            pushes: b[3],
            column: if b[4] == 0xff { None } else { Some(b[4]) },
            target: f32::from_le_bytes(b[5..9].try_into().ok()?),
            search: f32::from_le_bytes(b[59..63].try_into().ok()?),
            mover: Side::from_u8(b[63] & 1)?,
            start: b[63] & 2 != 0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;

    #[test]
    fn samples_round_trip_and_features_are_colour_symmetric() {
        let mut rng = Rng::new(9);
        let mut game = Game::new(&mut rng);
        for _ in 0..500 {
            if game.is_over() {
                game = Game::new(&mut rng);
            }
            let sample = Sample::from_game(&game, 1.0, 0.25);
            assert_eq!(Sample::from_bytes(&sample.to_bytes()), Some(sample));
            let f = extract(&game);
            let mut mirrored = game;
            mirrored.board.flip();
            mirrored.turn = game.turn.opponent();
            let g = extract(&mirrored);
            assert_eq!((&f.idx[..f.len], &f.val[..f.len]), (&g.idx[..g.len], &g.val[..g.len]));
            assert!(f.idx[..f.len].iter().all(|&i| (i as usize) < N_FEATURES));
            let actions = game.actions();
            game.apply(actions[rng.below(actions.len() as u32) as usize], &mut rng);
        }
    }
}
