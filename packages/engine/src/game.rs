//! The complete rules as a state machine: the Markov game of docs/rules.md §9.

use std::ops::Deref;

use crate::ball::{Ball, MAX_COLS, MAX_PUSHES, Side};
use crate::board::{Board, mix64};
use crate::rng::Rng;

/// Why a game ended. The numeric values are used by the WebAssembly interface.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
#[repr(u8)]
pub enum EndReason {
    /// The loser pushed the Key ball off the board.
    Key = 0,
    /// The loser did not push in time.
    Timeout = 1,
    /// The loser gave up.
    Resign = 2,
    /// The loser left an online game.
    Disconnect = 3,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct GameResult {
    pub winner: Side,
    pub reason: EndReason,
}

/// A decision of the player to move (§9.3).
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Action {
    /// Push one of the mover's lines. After the first push of a turn, only the same line.
    Push(u8),
    /// End the turn (only after at least one push).
    Stop,
}

/// Everything that happened during one push.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct PushOutcome {
    pub side: Side,
    pub col: usize,
    pub inserted: Ball,
    pub ejected: Ball,
    /// Pushes made so far this turn, including this one.
    pub pushes: u8,
    /// The turn passed to the opponent because of this push (Flip or 5th push).
    pub turn_ended: bool,
    /// Set if this push ended the game.
    pub result: Option<GameResult>,
}

/// A complete game state (§9.2). Small and `Copy`: cheap to clone for search.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct Game {
    pub board: Board,
    /// Player to move.
    pub turn: Side,
    /// The ball the next push will insert (visible to both players).
    pub next: Ball,
    /// Pushes made in the current turn (0–4 while the turn lasts).
    pub pushes: u8,
    /// The line pushed this turn; `None` before the first push.
    pub column: Option<u8>,
    pub result: Option<GameResult>,
}

impl Game {
    /// A new game: initial board, Left to move, a random first ball.
    pub fn new(rng: &mut Rng) -> Game {
        Game::from_position(Board::initial(), Side::Left, rng.ball())
    }

    /// A game starting at the beginning of `turn`'s turn in the given position.
    pub const fn from_position(board: Board, turn: Side, next: Ball) -> Game {
        Game { board, turn, next, pushes: 0, column: None, result: None }
    }

    #[inline]
    pub const fn is_over(&self) -> bool {
        self.result.is_some()
    }

    /// Whether the player to move may push line `col` now.
    #[inline]
    pub fn can_push(&self, col: usize) -> bool {
        !self.is_over()
            && (self.pushes as usize) < MAX_PUSHES
            && col < self.board.ejectors(self.turn)
            && self.column.is_none_or(|c| c as usize == col)
    }

    /// Whether the player to move may end the turn now (after at least one push).
    #[inline]
    pub const fn can_end_turn(&self) -> bool {
        !self.is_over() && self.pushes > 0
    }

    /// Legal actions of the player to move (empty when the game is over).
    pub fn actions(&self) -> Actions {
        let mut actions = Actions { items: [Action::Stop; MAX_COLS + 1], len: 0 };
        if self.is_over() {
            return actions;
        }
        match self.column {
            None => {
                for col in 0..self.board.ejectors(self.turn) {
                    actions.push(Action::Push(col as u8));
                }
            }
            Some(col) => {
                actions.push(Action::Push(col));
                actions.push(Action::Stop);
            }
        }
        actions
    }

    /// Plays one action, drawing the following ball from `rng` after a push.
    /// Panics if the action is illegal.
    #[inline]
    pub fn apply(&mut self, action: Action, rng: &mut Rng) {
        match action {
            Action::Push(col) => {
                self.push(col as usize, rng);
            }
            Action::Stop => self.end_turn(),
        }
    }

    /// Pushes line `col`, then draws the new next ball from `rng`.
    #[inline]
    pub fn push(&mut self, col: usize, rng: &mut Rng) -> PushOutcome {
        let following = rng.ball();
        self.push_then(col, following)
    }

    /// Pushes line `col`; `following` becomes the new next ball. Panics if illegal.
    pub fn push_then(&mut self, col: usize, following: Ball) -> PushOutcome {
        assert!(self.can_push(col), "illegal push on line {col}");
        let side = self.turn;
        let inserted = self.next;
        self.column = Some(col as u8);
        self.pushes += 1;
        let pushes = self.pushes;
        let ejected = self.board.push(side, col, inserted);
        self.next = following;

        let mut turn_ended = false;
        if ejected == Ball::Key {
            self.result = Some(GameResult { winner: side.opponent(), reason: EndReason::Key });
        } else if ejected == Ball::Flip || self.pushes as usize >= MAX_PUSHES {
            self.pass_turn();
            turn_ended = true;
        }
        PushOutcome { side, col, inserted, ejected, pushes, turn_ended, result: self.result }
    }

    /// Ends the turn. Panics before the first push of the turn.
    pub fn end_turn(&mut self) {
        assert!(self.can_end_turn(), "cannot end the turn before pushing");
        self.pass_turn();
    }

    /// The player to move ran out of time.
    pub fn timeout(&mut self) -> GameResult {
        self.finish(GameResult { winner: self.turn.opponent(), reason: EndReason::Timeout })
    }

    /// `loser` gave up (`EndReason::Resign`) or left (`EndReason::Disconnect`).
    pub fn forfeit(&mut self, loser: Side, reason: EndReason) -> GameResult {
        self.finish(GameResult { winner: loser.opponent(), reason })
    }

    /// Replaces a ball in place (used by the tutorial to stage positions).
    pub fn set_ball(&mut self, l: usize, r: usize, ball: Ball) {
        self.board.set(l, r, ball);
    }

    /// The board from the mover's point of view (see [`Board::view_for`]).
    #[inline]
    pub fn view(&self) -> Board {
        self.board.view_for(self.turn)
    }

    /// A 64-bit hash of the whole state (for transposition tables).
    pub fn hash64(&self) -> u64 {
        let extra = (self.turn as u64) | (self.next as u64) << 1 | u64::from(self.pushes) << 4 | u64::from(self.column.unwrap_or(15)) << 7;
        mix64(self.board.hash64() ^ extra)
    }

    fn finish(&mut self, result: GameResult) -> GameResult {
        *self.result.get_or_insert(result)
    }

    #[inline]
    fn pass_turn(&mut self) {
        self.turn = self.turn.opponent();
        self.pushes = 0;
        self.column = None;
    }
}

/// A fixed-capacity list of actions (no allocation).
#[derive(Clone, Copy, Debug)]
pub struct Actions {
    items: [Action; MAX_COLS + 1],
    len: usize,
}

impl Actions {
    #[inline]
    fn push(&mut self, action: Action) {
        self.items[self.len] = action;
        self.len += 1;
    }
}

impl Deref for Actions {
    type Target = [Action];

    #[inline]
    fn deref(&self) -> &[Action] {
        &self.items[..self.len]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scripted(board: Board) -> Game {
        Game::from_position(board, Side::Left, Ball::Common)
    }

    #[test]
    fn five_pushes_end_the_turn() {
        let mut game = scripted(Board::initial());
        for _ in 0..4 {
            assert!(!game.push_then(3, Ball::Common).turn_ended);
            assert!(!game.can_push(2));
            assert_eq!(&*game.actions(), &[Action::Push(3), Action::Stop]);
        }
        assert!(game.push_then(3, Ball::Common).turn_ended);
        assert_eq!(game.turn, Side::Right);
        assert_eq!(game.actions().len(), 6);
    }

    #[test]
    fn pushing_the_key_off_loses() {
        let mut board = Board::initial();
        board.set(0, 5, Ball::Key);
        let mut game = scripted(board);
        let outcome = game.push_then(0, Ball::Common);
        assert_eq!(outcome.result, Some(GameResult { winner: Side::Right, reason: EndReason::Key }));
        assert!(game.actions().is_empty());
    }

    #[test]
    fn a_flip_mirrors_the_board_and_ends_the_turn() {
        let mut board = Board::filled_common(4, 7);
        board.set(0, 6, Ball::Flip);
        board.set(3, 2, Ball::Key);
        let mut game = Game::from_position(board, Side::Left, Ball::DelCol);
        assert!(game.push_then(0, Ball::Common).turn_ended);
        assert_eq!(game.turn, Side::Right);
        assert_eq!((game.board.l_col(), game.board.r_col()), (7, 4));
        assert_eq!(game.board.get(2, 3), Ball::Key);
        assert_eq!(game.board.get(0, 0), Ball::DelCol);
    }

    #[test]
    fn stop_requires_a_push() {
        let mut game = scripted(Board::initial());
        assert!(!game.can_end_turn());
        game.apply(Action::Push(1), &mut Rng::new(1));
        game.apply(Action::Stop, &mut Rng::new(1));
        assert_eq!(game.turn, Side::Right);
    }

    #[test]
    fn a_game_starts_with_six_by_six_common_balls_and_left_to_move() {
        let game = Game::new(&mut Rng::new(1));
        assert_eq!(game.turn, Side::Left);
        assert_eq!((game.board.l_col(), game.board.r_col()), (6, 6));
        assert_eq!(game.board.count(Ball::Common), 36);
    }

    #[test]
    fn the_next_ball_enters_at_the_ejector_and_the_last_ball_falls_off() {
        let mut board = Board::initial();
        board.set(2, 5, Ball::DelCol);
        board.set(5, 1, Ball::AddCol);
        let mut game = Game::from_position(board, Side::Left, Ball::Flip);
        let left = game.push_then(2, Ball::Key);
        assert_eq!((left.inserted, left.ejected), (Ball::Flip, Ball::DelCol));
        assert_eq!(game.board.get(2, 0), Ball::Flip);
        game.end_turn();
        let right = game.push_then(1, Ball::Common);
        assert_eq!((right.inserted, right.ejected), (Ball::Key, Ball::AddCol));
        assert_eq!(game.board.get(0, 1), Ball::Key);
    }

    #[test]
    fn lines_are_added_up_to_ten_and_removed_down_to_three() {
        let mut board = Board::initial();
        board.set(1, 5, Ball::AddCol);
        let mut game = scripted(board);
        game.push_then(1, Ball::Common);
        assert_eq!((game.board.l_col(), game.board.r_col()), (6, 7));

        let mut full = Board::filled_common(6, 10);
        full.set(0, 9, Ball::AddCol);
        let mut game = scripted(full);
        game.push_then(0, Ball::Common);
        assert_eq!(game.board.r_col(), 10);

        let mut board = Board::initial();
        board.set(5, 4, Ball::DelCol);
        let mut game = Game::from_position(board, Side::Right, Ball::Common);
        game.push_then(4, Ball::Common);
        assert_eq!((game.board.l_col(), game.board.r_col()), (5, 6));

        let mut small = Board::filled_common(3, 6);
        small.set(2, 0, Ball::DelCol);
        let mut game = Game::from_position(small, Side::Right, Ball::Common);
        game.push_then(0, Ball::Common);
        assert_eq!(game.board.l_col(), 3);
    }

    #[test]
    fn timeouts_and_forfeits_decide_the_game() {
        let mut game = scripted(Board::initial());
        assert_eq!(game.timeout(), GameResult { winner: Side::Right, reason: EndReason::Timeout });
        // The first result stands.
        assert_eq!(game.forfeit(Side::Right, EndReason::Resign).reason, EndReason::Timeout);
        let mut game = scripted(Board::initial());
        assert_eq!(game.forfeit(Side::Right, EndReason::Disconnect), GameResult { winner: Side::Left, reason: EndReason::Disconnect });
    }

    #[test]
    fn balls_are_drawn_with_the_official_probabilities() {
        let mut rng = Rng::new(7);
        let mut counts = [0u32; 5];
        let n = 110_000;
        for _ in 0..n {
            counts[rng.ball() as usize] += 1;
        }
        let p = |count: u32| f64::from(count) / f64::from(n);
        assert!((p(counts[0]) - 7.0 / 11.0).abs() < 0.005);
        for &count in &counts[1..] {
            assert!((p(count) - 1.0 / 11.0).abs() < 0.005);
        }
    }
}
