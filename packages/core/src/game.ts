import { Board } from "./board.ts";
import { Ball, RULES, Side, opponent } from "./constants.ts";
import { randomBall, type Rng } from "./random.ts";

/** Why a game ended. */
export type EndReason =
  /** The loser pushed the Key ball off the board. */
  | "key"
  /** The loser did not make the first push of their turn in time. */
  | "timeout"
  /** The loser gave up. */
  | "resign"
  /** The loser left an online game. */
  | "disconnect";

export interface GameResult {
  winner: Side;
  reason: EndReason;
}

/** Everything that happened during one push. */
export interface PushOutcome {
  side: Side;
  col: number;
  /** The ball that entered the board (the previous `next`). */
  inserted: Ball;
  /** The ball that fell off the far end of the line. */
  ejected: Ball;
  /** Board size before the effect of `ejected` was applied. */
  before: { lCol: number; rCol: number };
  /** Number of pushes made so far this turn, including this one. */
  pushes: number;
  /** True if the turn passed to the opponent because of this push (Flip or push limit). */
  turnEnded: boolean;
  /** Set if this push ended the game. */
  result: GameResult | null;
}

export interface GameOptions {
  /** Produces the upcoming balls. Defaults to {@link randomBall} with `rng`. */
  ballSource?: () => Ball;
  /** Used by the default ball source. Defaults to `Math.random`. */
  rng?: Rng;
  /** Starting position. Defaults to {@link Board.initial}. */
  board?: Board;
  /** Who moves first. Defaults to Left. */
  firstTurn?: Side;
}

export class IllegalMoveError extends Error {}

/**
 * The complete rules of Myomyw as a synchronous state machine.
 *
 * A turn consists of 1 to {@link RULES.maxPushesPerTurn} pushes, all on the
 * same line. The turn ends when the player calls {@link endTurn}, when the
 * push limit is reached, or immediately after a Flip ball falls off. The
 * game ends when a Key ball falls off (its pusher loses), on timeout, or on
 * resignation.
 *
 * Real-time concerns (the turn timer, animation pacing) belong to the host
 * that drives this object; see {@link RULES.turnTimeLimitMs}.
 */
export class Game {
  readonly board: Board;
  turn: Side;
  /** The ball that the next push (by either player) will insert. Known to both players. */
  next: Ball;
  /** Pushes made in the current turn. */
  pushes = 0;
  /** The line chosen this turn, or null before the first push. */
  column: number | null = null;
  result: GameResult | null = null;

  private readonly ballSource: () => Ball;

  constructor(options: GameOptions = {}) {
    const rng = options.rng ?? Math.random;
    this.ballSource = options.ballSource ?? (() => randomBall(rng));
    this.board = options.board?.clone() ?? Board.initial();
    this.turn = options.firstTurn ?? Side.Left;
    this.next = this.ballSource();
  }

  get over(): boolean {
    return this.result !== null;
  }

  /** Whether the current player may push line `col` now. */
  canPush(col: number): boolean {
    if (this.over || this.pushes >= RULES.maxPushesPerTurn) return false;
    if (!Number.isInteger(col) || col < 0 || col >= this.board.ejectors(this.turn)) return false;
    return this.column === null || this.column === col;
  }

  /** Whether the current player may end their turn now (they must push at least once). */
  canEndTurn(): boolean {
    return !this.over && this.pushes > 0;
  }

  push(col: number): PushOutcome {
    if (!this.canPush(col)) throw new IllegalMoveError(`Illegal push on line ${col}`);
    const side = this.turn;
    const inserted = this.next;
    const before = { lCol: this.board.lCol, rCol: this.board.rCol };
    this.column = col;
    this.pushes++;
    const ejected = this.board.push(side, col, inserted);
    this.next = this.ballSource();
    const pushes = this.pushes;

    let turnEnded = false;
    if (ejected === Ball.Key) {
      this.result = { winner: opponent(side), reason: "key" };
    } else if (ejected === Ball.Flip || this.pushes >= RULES.maxPushesPerTurn) {
      this.passTurn();
      turnEnded = true;
    }
    return { side, col, inserted, ejected, before, pushes, turnEnded, result: this.result };
  }

  endTurn(): void {
    if (!this.canEndTurn()) throw new IllegalMoveError("Cannot end the turn before pushing");
    this.passTurn();
  }

  /** The current player ran out of time. */
  timeout(): GameResult {
    return this.finish({ winner: opponent(this.turn), reason: "timeout" });
  }

  /** `loser` gave up (or disconnected). */
  forfeit(loser: Side, reason: "resign" | "disconnect" = "resign"): GameResult {
    return this.finish({ winner: opponent(loser), reason });
  }

  private finish(result: GameResult): GameResult {
    if (!this.result) this.result = result;
    return this.result;
  }

  private passTurn(): void {
    this.turn = opponent(this.turn);
    this.pushes = 0;
    this.column = null;
  }
}
