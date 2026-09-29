/**
 * Game vocabulary shared by the engine bindings, the server and the client.
 * Values mirror `src/ball.rs` and `src/game.rs`.
 */

/**
 * The two players. Numeric values match the engine and the wire protocol.
 * - `Left`  (green) owns the ejectors on the upper-left edge and moves first.
 * - `Right` (blue)  owns the ejectors on the upper-right edge.
 */
export const Side = { Left: 0, Right: 1 } as const;
export type Side = (typeof Side)[keyof typeof Side];

export function opponent(side: Side): Side {
  return (side ^ 1) as Side;
}

/** Ball kinds (see docs/rules.md §6). */
export const Ball = {
  /** Black. No effect when pushed off. */
  Common: 0,
  /** Red. Whoever pushes it off the board loses. */
  Key: 1,
  /** Green "+". The pusher's opponent gains a line. */
  AddCol: 2,
  /** Yellow "−". The pusher's opponent loses a line. */
  DelCol: 3,
  /** Blue arrow. Mirrors the board and ends the pusher's turn. */
  Flip: 4,
} as const;
export type Ball = (typeof Ball)[keyof typeof Ball];

/** Rule constants (see docs/rules.md). */
export const RULES = {
  /** Maximum number of ejectors per side, and the size of the cell grid. */
  maxCols: 10,
  /** Minimum number of ejectors per side. */
  minCols: 3,
  /** Ejectors per side at the start of a game. */
  initialCols: 6,
  /** Maximum number of pushes in a single turn. */
  maxPushesPerTurn: 5,
  /** Default time a player has for each action: every push, and ending the turn (players and servers may change it). */
  timeLimitMs: 20_000,
} as const;

/** Why a game ended. */
export type EndReason = "key" | "timeout" | "resign" | "disconnect";
/** Engine numbering of {@link EndReason}. */
export const END_REASONS: readonly EndReason[] = ["key", "timeout", "resign", "disconnect"];

export interface GameResult {
  winner: Side;
  reason: EndReason;
}

/**
 * A board as plain data: `cells[l][r]` is the ball where Left line `l`
 * crosses Right line `r`; the grid is always `maxCols × maxCols`, and cells
 * outside `lCol × rCol` are common balls.
 */
export interface BoardSnapshot {
  cells: Ball[][];
  /** Number of Left ejectors (= length of Right's lines). */
  lCol: number;
  /** Number of Right ejectors (= length of Left's lines). */
  rCol: number;
}

/** Everything that happened during one push. */
export interface PushOutcome {
  side: Side;
  col: number;
  /** The ball that entered the board. */
  inserted: Ball;
  /** The ball that fell off the far end of the line. */
  ejected: Ball;
  /** Pushes made so far this turn, including this one. */
  pushes: number;
  /** The turn passed to the opponent because of this push (Flip or 5th push). */
  turnEnded: boolean;
  /** Set if this push ended the game. */
  result: GameResult | null;
}

export class IllegalMoveError extends Error {}

/** The built-in computer opponents. */
export type Difficulty = "easy" | "normal" | "hard" | "impossible";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard", "impossible"];

/** Number of ejectors owned by `side`. */
export function ejectors(board: BoardSnapshot, side: Side): number {
  return side === Side.Left ? board.lCol : board.rCol;
}

/** The starting position: 6 × 6 common balls. */
export function initialBoard(): BoardSnapshot {
  return {
    cells: Array.from({ length: RULES.maxCols }, () => Array<Ball>(RULES.maxCols).fill(Ball.Common)),
    lCol: RULES.initialCols,
    rCol: RULES.initialCols,
  };
}
