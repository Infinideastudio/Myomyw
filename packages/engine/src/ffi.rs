//! A small C ABI, used by the WebAssembly build (see `js/index.ts`).
//!
//! Objects are heap pointers owned by the caller, who must free them. Data is
//! exchanged through a shared I/O buffer (`io_buffer`):
//!
//! | Bytes     | Contents                                                     |
//! | --------- | ------------------------------------------------------------ |
//! | 0, 1      | `l_col`, `r_col`                                             |
//! | 2..102    | cells, row-major (`l * 10 + r`), numeric ball ids            |
//! | 102..108  | game state: turn, next, pushes, column, winner, reason       |
//!
//! In the game state, "none" (no column yet, no winner yet) is 255. Functions
//! return `u32::MAX` (or null) on invalid input instead of panicking.

use std::cell::RefCell;

use crate::ai::{Agent, Difficulty, MctsAi, MctsParams, StrongAi, WeakAi, create_agent};
use crate::ball::{Ball, MAX_COLS, Side};
use crate::board::Board;
use crate::game::{EndReason, Game};
use crate::rng::Rng;

const BOARD_LEN: usize = 2 + MAX_COLS * MAX_COLS;
const IO_LEN: usize = BOARD_LEN + 6;
const INVALID: u32 = u32::MAX;
const NONE: u8 = 255;

thread_local! {
    /// The I/O buffer. The host reads and writes it directly between calls.
    static IO: RefCell<[u8; IO_LEN]> = const { RefCell::new([0; IO_LEN]) };
}

fn ball(value: u32) -> Option<Ball> {
    u8::try_from(value).ok().and_then(Ball::from_u8)
}

fn side(value: u32) -> Option<Side> {
    u8::try_from(value).ok().and_then(Side::from_u8)
}

fn read_board() -> Option<Board> {
    IO.with_borrow(|io| Board::from_cells(io[0] as usize, io[1] as usize, &io[2..BOARD_LEN]))
}

fn write_board(board: &Board) {
    IO.with_borrow_mut(|io| {
        io[0] = board.l_col() as u8;
        io[1] = board.r_col() as u8;
        io[2..BOARD_LEN].copy_from_slice(&board.to_cells());
    });
}

fn write_game(game: &Game) {
    write_board(&game.board);
    IO.with_borrow_mut(|io| {
        io[BOARD_LEN..].copy_from_slice(&[
            game.turn as u8,
            game.next as u8,
            game.pushes,
            game.column.unwrap_or(NONE),
            game.result.map_or(NONE, |r| r.winner as u8),
            game.result.map_or(NONE, |r| r.reason as u8),
        ]);
    });
}

/// Address of the I/O buffer (108 bytes); stable for the lifetime of the instance.
#[unsafe(no_mangle)]
pub extern "C" fn io_buffer() -> *mut u8 {
    IO.with(|io| io.as_ptr().cast())
}

// ---------------------------------------------------------------- boards

/// Creates a board from the I/O buffer; null if the buffer holds an invalid board.
#[unsafe(no_mangle)]
pub extern "C" fn board_from_io() -> *mut Board {
    read_board().map_or(std::ptr::null_mut(), |board| Box::into_raw(Box::new(board)))
}

/// Writes a board to the I/O buffer.
///
/// # Safety
/// `board` must come from `board_from_io` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn board_to_io(board: *const Board) {
    write_board(unsafe { &*board });
}

/// # Safety
/// `board` must come from `board_from_io` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn board_free(board: *mut Board) {
    drop(unsafe { Box::from_raw(board) });
}

/// One push (see `Board::push`); returns the ejected ball, or `u32::MAX` if invalid.
///
/// # Safety
/// `board` must come from `board_from_io` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn board_push(board: *mut Board, side_id: u32, col: u32, ball_id: u32) -> u32 {
    let board = unsafe { &mut *board };
    match (side(side_id), ball(ball_id)) {
        (Some(side), Some(ball)) if (col as usize) < board.ejectors(side) => board.push(side, col as usize, ball) as u32,
        _ => INVALID,
    }
}

/// # Safety
/// `board` must come from `board_from_io` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn board_evaluate(board: *const Board) -> i32 {
    unsafe { &*board }.evaluate()
}

// ---------------------------------------------------------------- games

/// A game together with the random generator that draws its balls.
pub struct GameHandle {
    game: Game,
    rng: Rng,
}

/// Starts a new game (initial position, Left to move). Balls are drawn from
/// `Rng::new(seed)`; the first next ball is `first` if it is a valid ball id.
#[unsafe(no_mangle)]
pub extern "C" fn game_new(seed: u32, first: u32) -> *mut GameHandle {
    let mut rng = Rng::new(seed);
    let next = ball(first).unwrap_or_else(|| rng.ball());
    Box::into_raw(Box::new(GameHandle { game: Game::from_position(Board::initial(), Side::Left, next), rng }))
}

/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_free(game: *mut GameHandle) {
    drop(unsafe { Box::from_raw(game) });
}

/// Writes the game state (board and turn state) to the I/O buffer.
///
/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_to_io(game: *const GameHandle) {
    write_game(&unsafe { &*game }.game);
}

/// Writes the board as seen by the player to move (flipped for Right) to the I/O buffer.
///
/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_view_to_io(game: *const GameHandle) {
    write_board(&unsafe { &*game }.game.view());
}

/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_can_push(game: *const GameHandle, col: u32) -> u32 {
    u32::from(unsafe { &*game }.game.can_push(col as usize))
}

/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_can_end_turn(game: *const GameHandle) -> u32 {
    u32::from(unsafe { &*game }.game.can_end_turn())
}

/// Pushes line `col`. The new next ball is `following` if it is a valid ball
/// id, else drawn from the game's generator. Returns
/// `ejected | inserted << 8 | turn_ended << 16`, or `u32::MAX` if illegal.
///
/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_push(game: *mut GameHandle, col: u32, following: u32) -> u32 {
    let handle = unsafe { &mut *game };
    if !handle.game.can_push(col as usize) {
        return INVALID;
    }
    let following = ball(following).unwrap_or_else(|| handle.rng.ball());
    let outcome = handle.game.push_then(col as usize, following);
    outcome.ejected as u32 | (outcome.inserted as u32) << 8 | u32::from(outcome.turn_ended) << 16
}

/// Ends the turn; 0, or `u32::MAX` if not allowed.
///
/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_end_turn(game: *mut GameHandle) -> u32 {
    let handle = unsafe { &mut *game };
    if !handle.game.can_end_turn() {
        return INVALID;
    }
    handle.game.end_turn();
    0
}

/// The player to move ran out of time.
///
/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_timeout(game: *mut GameHandle) {
    unsafe { &mut *game }.game.timeout();
}

/// `loser` gave up (`reason` 2) or left (`reason` 3); 0, or `u32::MAX` if invalid.
///
/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_forfeit(game: *mut GameHandle, loser: u32, reason: u32) -> u32 {
    let handle = unsafe { &mut *game };
    let reason = match reason {
        2 => EndReason::Resign,
        3 => EndReason::Disconnect,
        _ => return INVALID,
    };
    match side(loser) {
        Some(loser) => {
            handle.game.forfeit(loser, reason);
            0
        }
        None => INVALID,
    }
}

/// Replaces the ball in cell (l, r); 0, or `u32::MAX` if invalid.
///
/// # Safety
/// `game` must come from `game_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn game_set_ball(game: *mut GameHandle, l: u32, r: u32, ball_id: u32) -> u32 {
    let handle = unsafe { &mut *game };
    let board = &handle.game.board;
    match ball(ball_id) {
        Some(ball) if (l as usize) < board.l_col() && (r as usize) < board.r_col() => {
            handle.game.set_ball(l as usize, r as usize, ball);
            0
        }
        _ => INVALID,
    }
}

// ---------------------------------------------------------------- agents

/// An agent handle (a fat `Box<dyn Agent>` behind a thin pointer).
pub struct AgentHandle(Box<dyn Agent>);

/// Creates an agent: `kind` 0 = WeakAI, 1 = StrongAI(`depth`, `fillout`),
/// 2 = the Impossible AI (`depth` and `fillout` ignored), seeded with `seed`.
#[unsafe(no_mangle)]
pub extern "C" fn agent_new(kind: u32, depth: u32, fillout: u32, seed: u32) -> *mut AgentHandle {
    let agent: Box<dyn Agent> = match kind {
        0 => Box::new(WeakAi::new()),
        1 if depth >= 1 && fillout >= 1 => Box::new(StrongAi::new(depth, fillout, seed)),
        2 => create_agent(Difficulty::Impossible, seed),
        _ => return std::ptr::null_mut(),
    };
    Box::into_raw(Box::new(AgentHandle(agent)))
}

/// Creates an MCTS agent with the Impossible AI's network and custom settings:
/// `iters` iterations per decision (at least 1; the search keeps about one
/// node per iteration in memory) and PUCT exploration constant `puct` (> 0).
/// Returns null for invalid settings.
#[unsafe(no_mangle)]
pub extern "C" fn agent_new_mcts(iters: u32, puct: f32, seed: u32) -> *mut AgentHandle {
    if iters == 0 || !(puct > 0.0 && puct.is_finite()) {
        return std::ptr::null_mut();
    }
    let params = MctsParams { iters, puct, ..MctsParams::default() };
    Box::into_raw(Box::new(AgentHandle(Box::new(MctsAi::new(params, seed)))))
}

/// # Safety
/// `agent` must come from `agent_new` or `agent_new_mcts` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn agent_free(agent: *mut AgentHandle) {
    drop(unsafe { Box::from_raw(agent) });
}

/// Starts a turn with the board in the I/O buffer (the agent's view, agent = Left).
/// Returns 0, or `u32::MAX` if the buffer is invalid.
///
/// # Safety
/// `agent` must come from `agent_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn agent_begin_turn(agent: *mut AgentHandle) -> u32 {
    let agent = unsafe { &mut *agent };
    match read_board() {
        Some(board) => {
            agent.0.begin_turn(&board);
            0
        }
        None => INVALID,
    }
}

/// # Safety
/// `agent` must come from `agent_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn agent_first_push(agent: *mut AgentHandle, next: u32) -> u32 {
    let agent = unsafe { &mut *agent };
    ball(next).map_or(INVALID, |next| agent.0.first_push(next) as u32)
}

/// Returns 1 to push again, 0 to end the turn.
///
/// # Safety
/// `agent` must come from `agent_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn agent_push_again(agent: *mut AgentHandle, next: u32) -> u32 {
    let agent = unsafe { &mut *agent };
    ball(next).map_or(INVALID, |next| u32::from(agent.0.push_again(next)))
}

/// The agent's estimated probability of winning as of its latest decision, or −1 if it has none.
///
/// # Safety
/// `agent` must come from `agent_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn agent_win_estimate(agent: *mut AgentHandle) -> f32 {
    let agent = unsafe { &*agent };
    agent.0.win_estimate().unwrap_or(-1.0)
}
