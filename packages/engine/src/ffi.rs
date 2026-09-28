//! A small C ABI, used by the WebAssembly build (see `js/index.ts`).
//!
//! Objects are heap pointers owned by the caller, who must free them. Boards
//! are exchanged through a shared I/O buffer (`io_buffer`) with the layout
//! `[l_col, r_col, cells[0..100]]`, cells row-major (`l * 10 + r`) with the
//! numeric ball ids. Functions return `u32::MAX` (or null) on invalid input
//! instead of panicking.

use std::cell::RefCell;

use crate::ai::{Agent, StrongAi, WeakAi};
use crate::ball::{Ball, MAX_COLS, Side};
use crate::board::Board;

const IO_LEN: usize = 2 + MAX_COLS * MAX_COLS;
const INVALID: u32 = u32::MAX;

thread_local! {
    /// The I/O buffer. The host reads and writes it directly between calls.
    static IO: RefCell<[u8; IO_LEN]> = const { RefCell::new([0; IO_LEN]) };
}

fn read_board() -> Option<Board> {
    IO.with_borrow(|io| Board::from_cells(io[0] as usize, io[1] as usize, &io[2..]))
}

fn write_board(board: &Board) {
    IO.with_borrow_mut(|io| {
        io[0] = board.l_col() as u8;
        io[1] = board.r_col() as u8;
        io[2..].copy_from_slice(&board.to_cells());
    });
}

/// Address of the board I/O buffer (`2 + 100` bytes); stable for the lifetime of the instance.
#[unsafe(no_mangle)]
pub extern "C" fn io_buffer() -> *mut u8 {
    IO.with(|io| io.as_ptr().cast())
}

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
pub unsafe extern "C" fn board_push(board: *mut Board, side: u32, col: u32, ball: u32) -> u32 {
    let board = unsafe { &mut *board };
    match (Side::from_u8(side as u8), Ball::from_u8(ball as u8)) {
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

/// An agent handle (a fat `Box<dyn Agent>` behind a thin pointer).
pub struct AgentHandle(Box<dyn Agent>);

/// Creates an agent: `kind` 0 = WeakAI, 1 = StrongAI(`depth`, `fillout`), seeded with `seed`.
#[unsafe(no_mangle)]
pub extern "C" fn agent_new(kind: u32, depth: u32, fillout: u32, seed: u32) -> *mut AgentHandle {
    let agent: Box<dyn Agent> = match kind {
        0 => Box::new(WeakAi::new()),
        1 if depth >= 1 && fillout >= 1 => Box::new(StrongAi::new(depth, fillout, seed)),
        _ => return std::ptr::null_mut(),
    };
    Box::into_raw(Box::new(AgentHandle(agent)))
}

/// # Safety
/// `agent` must come from `agent_new` and not have been freed.
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
    Ball::from_u8(next as u8).map_or(INVALID, |next| agent.0.first_push(next) as u32)
}

/// Returns 1 to push again, 0 to end the turn.
///
/// # Safety
/// `agent` must come from `agent_new` and not have been freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn agent_push_again(agent: *mut AgentHandle, next: u32) -> u32 {
    let agent = unsafe { &mut *agent };
    Ball::from_u8(next as u8).map_or(INVALID, |next| u32::from(agent.0.push_again(next)))
}
