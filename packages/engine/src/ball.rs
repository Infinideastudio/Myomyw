//! Players, balls and rule constants (see docs/rules.md).

/// Maximum number of ejectors per side, and the size of the board's backing grid.
pub const MAX_COLS: usize = 10;
/// Minimum number of ejectors per side.
pub const MIN_COLS: usize = 3;
/// Ejectors per side at the start of a game.
pub const INITIAL_COLS: usize = 6;
/// Maximum number of pushes in one turn.
pub const MAX_PUSHES: usize = 5;

/// The two players. `Left` (Green) owns the upper-left ejectors and moves first.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
#[repr(u8)]
pub enum Side {
    Left = 0,
    Right = 1,
}

impl Side {
    #[inline]
    pub const fn opponent(self) -> Side {
        match self {
            Side::Left => Side::Right,
            Side::Right => Side::Left,
        }
    }

    pub const fn from_u8(value: u8) -> Option<Side> {
        match value {
            0 => Some(Side::Left),
            1 => Some(Side::Right),
            _ => None,
        }
    }
}

/// Ball kinds. The numeric values match `Ball` in `@myomyw/core` and the wire protocol.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
#[repr(u8)]
pub enum Ball {
    /// No effect.
    Common = 0,
    /// The player who pushes it off loses.
    Key = 1,
    /// The pusher's opponent gains a line.
    AddCol = 2,
    /// The pusher's opponent loses a line.
    DelCol = 3,
    /// Mirrors the board and ends the pusher's turn.
    Flip = 4,
}

impl Ball {
    pub const ALL: [Ball; 5] = [Ball::Common, Ball::Key, Ball::AddCol, Ball::DelCol, Ball::Flip];

    pub const fn from_u8(value: u8) -> Option<Ball> {
        match value {
            0 => Some(Ball::Common),
            1 => Some(Ball::Key),
            2 => Some(Ball::AddCol),
            3 => Some(Ball::DelCol),
            4 => Some(Ball::Flip),
            _ => None,
        }
    }

    /// Index of this kind's bit plane in [`Board`](crate::Board); common balls have none.
    #[inline]
    pub(crate) const fn plane(self) -> Option<usize> {
        match self {
            Ball::Common => None,
            other => Some(other as usize - 1),
        }
    }

    #[inline]
    pub(crate) const fn from_plane(plane: usize) -> Ball {
        match plane {
            0 => Ball::Key,
            1 => Ball::AddCol,
            2 => Ball::DelCol,
            _ => Ball::Flip,
        }
    }
}
