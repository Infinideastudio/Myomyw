//! The board as bitboards.

use std::fmt;

use crate::ball::{Ball, INITIAL_COLS, MAX_COLS, MIN_COLS, Side};

/// Bit index of cell (l, r) is `l * STRIDE + r`.
const STRIDE: usize = MAX_COLS;
const PLANES: usize = 4;
const KEY: usize = 0;

#[inline]
const fn bit(l: usize, r: usize) -> u128 {
    1u128 << (l * STRIDE + r)
}

/// The first `len` cells of row 0.
#[inline]
const fn row_mask(len: usize) -> u128 {
    (1u128 << len) - 1
}

/// `COL0[len]`: the first `len` cells of column 0.
const COL0: [u128; MAX_COLS + 1] = {
    let mut table = [0u128; MAX_COLS + 1];
    let mut len = 1;
    while len <= MAX_COLS {
        table[len] = table[len - 1] | bit(len - 1, 0);
        len += 1;
    }
    table
};

/// A Myomyw board: `l_col × r_col` cells, where `l_col` is the number of Left
/// (Green) ejectors and `r_col` the number of Right (Blue) ejectors.
///
/// Cell `(l, r)` is where Left line `l` crosses Right line `r` (0-based, 0 =
/// next to the top corner). Left pushes line `l` from `(l, 0)` towards
/// `(l, r_col − 1)`; Right pushes line `r` from `(0, r)` towards `(l_col − 1, r)`.
///
/// Representation: one 128-bit plane per special ball kind (Key, AddCol,
/// DelCol, Flip) with bit `l * 10 + r`; a cell with no bit set holds a common
/// ball. Bits outside the board are always zero. A push is a handful of
/// mask-and-shift operations per plane, and the whole board is a small `Copy`
/// value, so search algorithms can copy positions freely.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct Board {
    planes: [u128; PLANES],
    l_col: u8,
    r_col: u8,
}

impl Default for Board {
    fn default() -> Board {
        Board::initial()
    }
}

impl Board {
    /// The starting position: 6 × 6 common balls.
    pub const fn initial() -> Board {
        Board { planes: [0; PLANES], l_col: INITIAL_COLS as u8, r_col: INITIAL_COLS as u8 }
    }

    /// An `l_col × r_col` board of common balls.
    pub fn filled_common(l_col: usize, r_col: usize) -> Board {
        assert!((MIN_COLS..=MAX_COLS).contains(&l_col) && (MIN_COLS..=MAX_COLS).contains(&r_col), "board size out of range");
        Board { planes: [0; PLANES], l_col: l_col as u8, r_col: r_col as u8 }
    }

    /// Builds a board from a row-major `10 × 10` cell array (`cells[l * 10 + r]`,
    /// the layout of `BoardSnapshot` in TypeScript). Cells outside `l_col × r_col` are ignored.
    /// Returns `None` for an invalid size or ball value.
    pub fn from_cells(l_col: usize, r_col: usize, cells: &[u8]) -> Option<Board> {
        if !(MIN_COLS..=MAX_COLS).contains(&l_col) || !(MIN_COLS..=MAX_COLS).contains(&r_col) || cells.len() < MAX_COLS * MAX_COLS {
            return None;
        }
        let mut board = Board::filled_common(l_col, r_col);
        for l in 0..l_col {
            for r in 0..r_col {
                board.set(l, r, Ball::from_u8(cells[l * STRIDE + r])?);
            }
        }
        Some(board)
    }

    /// Row-major `10 × 10` cell array; cells outside the board are common.
    pub fn to_cells(&self) -> [u8; MAX_COLS * MAX_COLS] {
        let mut cells = [Ball::Common as u8; MAX_COLS * MAX_COLS];
        for (plane, &bits) in self.planes.iter().enumerate() {
            let mut rest = bits;
            while rest != 0 {
                let index = rest.trailing_zeros() as usize;
                rest &= rest - 1;
                cells[index] = Ball::from_plane(plane) as u8;
            }
        }
        cells
    }

    #[inline]
    pub const fn l_col(&self) -> usize {
        self.l_col as usize
    }

    #[inline]
    pub const fn r_col(&self) -> usize {
        self.r_col as usize
    }

    /// Number of ejectors (lines) owned by `side`.
    #[inline]
    pub const fn ejectors(&self, side: Side) -> usize {
        match side {
            Side::Left => self.l_col as usize,
            Side::Right => self.r_col as usize,
        }
    }

    /// Length of each line pushed by `side`.
    #[inline]
    pub const fn line_len(&self, side: Side) -> usize {
        self.ejectors(side.opponent())
    }

    #[inline]
    pub fn get(&self, l: usize, r: usize) -> Ball {
        debug_assert!(l < self.l_col() && r < self.r_col());
        let b = bit(l, r);
        for (plane, bits) in self.planes.iter().enumerate() {
            if bits & b != 0 {
                return Ball::from_plane(plane);
            }
        }
        Ball::Common
    }

    pub fn set(&mut self, l: usize, r: usize, ball: Ball) {
        assert!(l < self.l_col() && r < self.r_col(), "cell outside the board");
        let b = bit(l, r);
        for bits in &mut self.planes {
            *bits &= !b;
        }
        if let Some(plane) = ball.plane() {
            self.planes[plane] |= b;
        }
    }

    /// Number of balls of kind `ball` on the board.
    pub fn count(&self, ball: Ball) -> usize {
        match ball.plane() {
            Some(plane) => self.planes[plane].count_ones() as usize,
            None => self.l_col() * self.r_col() - self.planes.iter().map(|p| p.count_ones() as usize).sum::<usize>(),
        }
    }

    /// One push: `side` inserts `ball` into its line `col`; the last ball of the
    /// line falls off and its effect is applied. Returns the ball that fell off.
    /// Winning and turn handling belong to [`Game`](crate::Game).
    #[inline]
    pub fn push(&mut self, side: Side, col: usize, ball: Ball) -> Ball {
        let ejected = self.shift(side, col, ball);
        self.apply_effect(side, ejected);
        ejected
    }

    /// The ball that would fall off if `side` pushed line `col` now.
    #[inline]
    pub fn exit_ball(&self, side: Side, col: usize) -> Ball {
        match side {
            Side::Left => self.get(col, self.r_col() - 1),
            Side::Right => self.get(self.l_col() - 1, col),
        }
    }

    /// First half of [`push`](Self::push): only moves the balls.
    pub fn shift(&mut self, side: Side, col: usize, ball: Ball) -> Ball {
        let (l_col, r_col) = (self.l_col(), self.r_col());
        let (mask, step, exit, entry) = match side {
            Side::Left => {
                assert!(col < l_col, "no such line");
                (row_mask(r_col) << (col * STRIDE), 1, bit(col, r_col - 1), bit(col, 0))
            }
            Side::Right => {
                assert!(col < r_col, "no such line");
                (COL0[l_col] << col, STRIDE, bit(l_col - 1, col), bit(0, col))
            }
        };
        let mut ejected = Ball::Common;
        for (plane, bits) in self.planes.iter_mut().enumerate() {
            if *bits & exit != 0 {
                ejected = Ball::from_plane(plane);
            }
            *bits = (*bits & !mask) | (((*bits & mask) << step) & mask);
        }
        if let Some(plane) = ball.plane() {
            self.planes[plane] |= entry;
        }
        ejected
    }

    /// Second half of [`push`](Self::push): applies the effect of a ball that `side` pushed off.
    pub fn apply_effect(&mut self, side: Side, ejected: Ball) {
        match (ejected, side) {
            (Ball::AddCol, Side::Left) if self.r_col() < MAX_COLS => self.r_col += 1,
            (Ball::AddCol, Side::Right) if self.l_col() < MAX_COLS => self.l_col += 1,
            (Ball::DelCol, Side::Left) if self.r_col() > MIN_COLS => {
                let keep = !(COL0[self.l_col()] << (self.r_col() - 1));
                self.planes.iter_mut().for_each(|bits| *bits &= keep);
                self.r_col -= 1;
            }
            (Ball::DelCol, Side::Right) if self.l_col() > MIN_COLS => {
                let keep = !(row_mask(self.r_col()) << ((self.l_col() - 1) * STRIDE));
                self.planes.iter_mut().for_each(|bits| *bits &= keep);
                self.l_col -= 1;
            }
            (Ball::Flip, _) => self.flip(),
            _ => {}
        }
    }

    /// Mirrors the board: cell (l, r) moves to (r, l) and the ejector counts swap.
    pub fn flip(&mut self) {
        for bits in &mut self.planes {
            *bits = transpose(*bits);
        }
        std::mem::swap(&mut self.l_col, &mut self.r_col);
    }

    /// The board as seen by `side` if it were playing Left (flipped for Right).
    #[inline]
    pub fn view_for(&self, side: Side) -> Board {
        let mut view = *self;
        if side == Side::Right {
            view.flip();
        }
        view
    }

    /// Static evaluation from Left's point of view (the classic heuristic of
    /// the built-in AIs): for each line, the number of balls that can be pushed
    /// off before a Key would fall (twice the line length if there is no Key);
    /// Left's lines count positively, Right's negatively.
    pub fn evaluate(&self) -> i32 {
        let (l_col, r_col) = (self.l_col(), self.r_col());
        // Highest Key position in each Left line (row) and each Right line (column).
        let mut row_top = [-1i32; MAX_COLS];
        let mut col_top = [-1i32; MAX_COLS];
        let mut keys = self.planes[KEY];
        while keys != 0 {
            let index = keys.trailing_zeros() as usize;
            keys &= keys - 1;
            let (l, r) = (index / STRIDE, index % STRIDE);
            row_top[l] = row_top[l].max(r as i32);
            col_top[r] = col_top[r].max(l as i32);
        }
        let line_value = |top: i32, len: usize| if top < 0 { 2 * len as i32 } else { len as i32 - 1 - top };
        let left: i32 = row_top[..l_col].iter().map(|&top| line_value(top, r_col)).sum();
        let right: i32 = col_top[..r_col].iter().map(|&top| line_value(top, l_col)).sum();
        left - right
    }

    /// A 64-bit hash of the position (for transposition tables).
    pub fn hash64(&self) -> u64 {
        let mut h = (u64::from(self.l_col) << 8) | u64::from(self.r_col);
        for &bits in &self.planes {
            h = mix64(h ^ bits as u64);
            h = mix64(h ^ (bits >> 64) as u64);
        }
        h
    }
}

/// Transposes a plane over the full 10 × 10 grid. Planes are sparse, so this
/// visits set bits only.
fn transpose(mut bits: u128) -> u128 {
    let mut out = 0;
    while bits != 0 {
        let index = bits.trailing_zeros() as usize;
        bits &= bits - 1;
        out |= bit(index % STRIDE, index / STRIDE);
    }
    out
}

/// splitmix64 finaliser.
#[inline]
pub(crate) fn mix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9e37_79b9_7f4a_7c15);
    x = (x ^ (x >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    x ^ (x >> 31)
}

impl fmt::Debug for Board {
    /// One row per Left line: `.` common, `K` key, `+` add, `-` remove, `F` flip.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "Board {}x{}", self.l_col, self.r_col)?;
        for l in 0..self.l_col() {
            let row: String = (0..self.r_col())
                .map(|r| match self.get(l, r) {
                    Ball::Common => '.',
                    Ball::Key => 'K',
                    Ball::AddCol => '+',
                    Ball::DelCol => '-',
                    Ball::Flip => 'F',
                })
                .collect();
            writeln!(f, "  {row}")?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;

    /// A straightforward array implementation of the rules (like the original
    /// game's `GameNode.js`), used as the reference model.
    #[derive(Clone)]
    struct Naive {
        cells: [[Ball; MAX_COLS]; MAX_COLS],
        l_col: usize,
        r_col: usize,
    }

    impl Naive {
        fn new() -> Naive {
            Naive { cells: [[Ball::Common; MAX_COLS]; MAX_COLS], l_col: 6, r_col: 6 }
        }

        fn push(&mut self, side: Side, col: usize, ball: Ball) -> Ball {
            let last;
            if side == Side::Left {
                last = self.cells[col][self.r_col - 1];
                for i in (1..self.r_col).rev() {
                    self.cells[col][i] = self.cells[col][i - 1];
                }
                self.cells[col][0] = ball;
            } else {
                last = self.cells[self.l_col - 1][col];
                for i in (1..self.l_col).rev() {
                    self.cells[i][col] = self.cells[i - 1][col];
                }
                self.cells[0][col] = ball;
            }
            let (l, r) = (self.l_col, self.r_col);
            match (last, side) {
                (Ball::AddCol, Side::Left) => self.resize(l, r + 1),
                (Ball::AddCol, Side::Right) => self.resize(l + 1, r),
                (Ball::DelCol, Side::Left) => self.resize(l, r.wrapping_sub(1)),
                (Ball::DelCol, Side::Right) => self.resize(l.wrapping_sub(1), r),
                (Ball::Flip, _) => {
                    for a in 0..MAX_COLS {
                        for b in a + 1..MAX_COLS {
                            let t = self.cells[a][b];
                            self.cells[a][b] = self.cells[b][a];
                            self.cells[b][a] = t;
                        }
                    }
                    std::mem::swap(&mut self.l_col, &mut self.r_col);
                }
                _ => {}
            }
            last
        }

        fn resize(&mut self, l_col: usize, r_col: usize) {
            if !(MIN_COLS..=MAX_COLS).contains(&l_col) || !(MIN_COLS..=MAX_COLS).contains(&r_col) {
                return;
            }
            for l in self.l_col..l_col {
                for r in 0..r_col {
                    self.cells[l][r] = Ball::Common;
                }
            }
            for l in 0..l_col {
                for r in self.r_col..r_col {
                    self.cells[l][r] = Ball::Common;
                }
            }
            self.l_col = l_col;
            self.r_col = r_col;
        }

        fn evaluate(&self) -> i32 {
            let mut total = 0;
            for l in 0..self.l_col {
                let mut val = 0;
                for r in (0..self.r_col).rev() {
                    if self.cells[l][r] == Ball::Key {
                        break;
                    }
                    val += 1;
                }
                total += if val == self.r_col { 2 * val } else { val } as i32;
            }
            for r in 0..self.r_col {
                let mut val = 0;
                for l in (0..self.l_col).rev() {
                    if self.cells[l][r] == Ball::Key {
                        break;
                    }
                    val += 1;
                }
                total -= if val == self.l_col { 2 * val } else { val } as i32;
            }
            total
        }
    }

    fn assert_same(board: &Board, naive: &Naive) {
        assert_eq!((board.l_col(), board.r_col()), (naive.l_col, naive.r_col));
        for l in 0..naive.l_col {
            for r in 0..naive.r_col {
                assert_eq!(board.get(l, r), naive.cells[l][r], "cell ({l}, {r})");
            }
        }
        // Invariant: no bits outside the board.
        let outside = !(0..naive.l_col).fold(0u128, |m, l| m | (row_mask(naive.r_col) << (l * STRIDE)));
        assert!(board.planes.iter().all(|p| p & outside == 0));
        assert_eq!(board.evaluate(), naive.evaluate());
    }

    #[test]
    fn matches_the_reference_model() {
        let mut rng = Rng::new(7);
        for _ in 0..300 {
            let mut board = Board::initial();
            let mut naive = Naive::new();
            for _ in 0..300 {
                let side = if rng.below(2) == 0 { Side::Left } else { Side::Right };
                let col = rng.below(board.ejectors(side) as u32) as usize;
                let ball = rng.ball();
                assert_eq!(board.exit_ball(side, col), naive.clone().push(side, col, ball));
                assert_eq!(board.push(side, col, ball), naive.push(side, col, ball));
                assert_same(&board, &naive);
            }
        }
    }

    #[test]
    fn cells_round_trip() {
        let mut rng = Rng::new(3);
        let mut board = Board::initial();
        for _ in 0..200 {
            board.push(Side::Left, rng.below(board.l_col() as u32) as usize, rng.ball());
            board.push(Side::Right, rng.below(board.r_col() as u32) as usize, rng.ball());
            assert_eq!(Board::from_cells(board.l_col(), board.r_col(), &board.to_cells()), Some(board));
        }
    }

    #[test]
    fn view_for_right_is_the_flipped_board() {
        let mut board = Board::filled_common(4, 7);
        board.set(1, 5, Ball::Key);
        let view = board.view_for(Side::Right);
        assert_eq!((view.l_col(), view.r_col()), (7, 4));
        assert_eq!(view.get(5, 1), Ball::Key);
        assert_eq!(board.view_for(Side::Left), board);
    }
}
