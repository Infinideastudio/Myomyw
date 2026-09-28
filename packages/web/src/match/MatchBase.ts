import { Ball, initialBoard, type BoardSnapshot, type GameResult, type Side } from "@myomyw/engine";
import { DisplayBoard, type Ghost } from "./display.ts";
import type { Timing } from "./timing.ts";
import type { MatchController, MatchSnapshot } from "./types.ts";

/**
 * Shared plumbing for match controllers: the snapshot store consumed by
 * React (`useSyncExternalStore`), the animated display board, and timers that
 * are cleaned up on dispose.
 */
export abstract class MatchBase implements MatchController {
  protected display: DisplayBoard;
  protected readonly timing: Timing;
  private snapshot: MatchSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly timeouts = new Set<ReturnType<typeof setTimeout>>();
  protected disposed = false;

  constructor(options: { names: readonly [string, string]; controllable: readonly [boolean, boolean]; timing: Timing; board?: BoardSnapshot }) {
    this.timing = options.timing;
    this.display = new DisplayBoard(options.board ?? initialBoard());
    this.snapshot = {
      names: options.names,
      controllable: options.controllable,
      lCol: this.display.lCol,
      rCol: this.display.rCol,
      balls: this.display.sprites(),
      ghosts: [],
      entering: null,
      animMs: 0,
      flips: 0,
      phase: "waiting",
      turn: null,
      next: null,
      pushes: 0,
      activeLine: null,
      timer: null,
      result: null,
    };
  }

  abstract press(col: number): void;
  abstract release(): void;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): MatchSnapshot => this.snapshot;

  dispose(): void {
    this.disposed = true;
    for (const t of this.timeouts) clearTimeout(t);
    this.timeouts.clear();
    this.listeners.clear();
  }

  protected get state(): MatchSnapshot {
    return this.snapshot;
  }

  protected update(patch: Partial<MatchSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** setTimeout that is cancelled automatically on dispose. Returns a cancel function. */
  protected later(fn: () => void, ms: number): () => void {
    const handle = setTimeout(() => {
      this.timeouts.delete(handle);
      if (!this.disposed) fn();
    }, ms);
    this.timeouts.add(handle);
    return () => {
      clearTimeout(handle);
      this.timeouts.delete(handle);
    };
  }

  /** Replaces the whole board (e.g. when an online game starts). */
  protected resetBoard(board: BoardSnapshot): void {
    this.display = new DisplayBoard(board);
    this.update({ lCol: board.lCol, rCol: board.rCol, balls: this.display.sprites(), ghosts: [], entering: null, animMs: 0 });
  }

  /** Shows the movement of one push. Returns the ball that fell off. */
  protected showShift(side: Side, col: number, inserted: Ball, next: Ball, pushes: number): Ball {
    const { ejected, ghost, entering } = this.display.shift(side, col, inserted);
    this.update({
      balls: this.display.sprites(),
      entering,
      animMs: this.timing.pushMs,
      next,
      pushes,
      activeLine: col,
      timer: null,
    });
    this.addGhosts([ghost], this.timing.pushMs);
    return ejected;
  }

  /**
   * Shows the effect of the ball that fell off (grow, shrink or mirror) and
   * adopts `board`, the engine's position after the push.
   */
  protected showEffect(ejected: Ball, board: BoardSnapshot): void {
    const removed = this.display.applyEffect(ejected, board);
    if (ejected !== Ball.AddCol && ejected !== Ball.DelCol && ejected !== Ball.Flip) return;
    const flip = ejected === Ball.Flip;
    const animMs = flip ? this.timing.flipMs : this.timing.resizeMs;
    this.update({
      lCol: this.display.lCol,
      rCol: this.display.rCol,
      balls: this.display.sprites(),
      entering: null,
      animMs,
      flips: this.state.flips + (flip ? 1 : 0),
      activeLine: flip ? null : this.state.activeLine,
    });
    this.addGhosts(removed, animMs);
  }

  protected showTurn(turn: Side, timerMs: number | null): void {
    this.update({
      phase: "idle",
      turn,
      pushes: 0,
      activeLine: null,
      timer: timerMs === null ? null : { endsAt: performance.now() + timerMs, totalMs: timerMs },
    });
  }

  protected showResult(result: GameResult): void {
    this.update({ phase: "over", result, timer: null });
  }

  private addGhosts(ghosts: Ghost[], ms: number): void {
    if (ghosts.length === 0) return;
    const ids = new Set(ghosts.map((g) => g.id));
    this.update({ ghosts: [...this.state.ghosts.filter((g) => !ids.has(g.id)), ...ghosts] });
    this.later(() => this.update({ ghosts: this.state.ghosts.filter((g) => !ids.has(g.id)) }), ms + 50);
  }
}
