import { Side, type Ball, type GameResult, type PushOutcome, type WasmGame } from "@myomyw/engine";
import type { AsyncAgent } from "../ai/agents.ts";
import { engine } from "../engine.ts";
import { MatchBase } from "./MatchBase.ts";
import { NORMAL_TIMING, type Timing } from "./timing.ts";
import { canEndTurn, canPush } from "./types.ts";

/** Who plays a side in a local match. */
export type Seat =
  | { kind: "human" }
  | { kind: "ai"; agent: AsyncAgent }
  /** Nobody: the side never moves (used by the tutorial). */
  | { kind: "idle" };

export interface LocalMatchOptions {
  seats: readonly [Seat, Seat];
  names: readonly [string, string];
  /** Time a human player has for each action (every push, and ending the turn); null for no limit. Computer players are never timed. */
  timeLimitMs: number | null;
  timing?: Timing;
  /** Seed of the ball generator (random if omitted). */
  seed?: number;
  /** Supplies the balls instead of the generator (tutorial). */
  ballSource?: () => Ball;
  /** Start immediately (default true). Otherwise call {@link start}. */
  autoStart?: boolean;
}

/**
 * A match played entirely on this device: two humans, human vs computer,
 * computer vs computer, or the tutorial. Owns the authoritative game (a
 * `WasmGame` of the engine) and paces it:
 *
 *   human:    push (animated) → [push again (animated) …] → end turn
 *   computer: push (animated) → [cool down → push again …] → next turn
 *
 * Each action of a human player is timed separately. A computer player is
 * never timed; it is asked for its first push as soon as the previous turn
 * ends (before the last push of that turn is animated)
 * when its turn starts and whether to push again as soon as each push is made,
 * so it thinks during the pause before its turn and during the push animation
 * and the cool-down after it: a decision only delays the game if it takes
 * longer than those. Agents answer asynchronously (they may think in a Web
 * Worker); answers that arrive after the situation changed are ignored.
 */
export class LocalMatch extends MatchBase {
  protected readonly game: WasmGame;
  private readonly seats: readonly [Seat, Seat];
  private readonly timeLimitMs: number | null;
  private cancelPhase: (() => void) | null = null;
  private cancelTurnTimer: (() => void) | null = null;
  /** A computer player's first push of the coming turn, asked for as soon as the previous turn ended. */
  private firstDecision: Promise<number> | null = null;

  constructor(options: LocalMatchOptions) {
    const timing = options.timing ?? NORMAL_TIMING;
    const human = (seat: Seat) => seat.kind === "human";
    super({ names: options.names, controllable: [human(options.seats[0]), human(options.seats[1])], timing });
    this.seats = options.seats;
    this.timeLimitMs = options.timeLimitMs;
    this.game = engine().newGame({ seed: options.seed, ballSource: options.ballSource });
    this.update({ next: this.game.next });
    if (options.autoStart ?? true) this.start();
  }

  override dispose(): void {
    super.dispose();
    for (const seat of this.seats) if (seat.kind === "ai") seat.agent.dispose();
    this.game.free();
  }

  start(): void {
    if (this.state.phase === "waiting") this.startTurn();
  }

  push(col: number): void {
    if (!canPush(this.state, col) || this.seats[this.game.turn].kind !== "human" || !this.game.canPush(col)) return;
    this.makePush(col);
  }

  endTurn(): void {
    if (!canEndTurn(this.state) || this.seats[this.game.turn].kind !== "human" || !this.game.canEndTurn()) return;
    this.nextTurn();
  }

  /** Stops the turn timer without a timeout (tutorial). */
  protected stopTimer(): void {
    this.cancelTurnTimer?.();
    this.cancelTurnTimer = null;
    this.update({ timer: null });
  }

  /** Hook for subclasses, called whenever a turn starts. */
  protected onTurnStart(): void {}

  private startTurn(): void {
    const side = this.game.turn;
    const seat = this.seats[side];
    const limitMs = this.limitFor(side);
    this.showTurn(side, limitMs);
    this.startClock(limitMs);
    if (seat.kind === "ai") {
      const decision = this.firstDecision ?? this.askFirstPush();
      this.firstDecision = null;
      this.cancelPhase = this.later(() => {
        decision!.then((col) => {
          if (this.stillDeciding(side, 0)) this.makePush(col);
        }, agentFailed);
      }, this.timing.aiThinkMs);
    }
    this.onTurnStart();
  }

  /** Asks the computer player to move for its first push of the turn. */
  private askFirstPush(): Promise<number> | null {
    const side = this.game.turn;
    const seat = this.seats[side];
    if (seat.kind !== "ai") return null;
    seat.agent.beginTurn(this.game.view());
    return seat.agent.firstPush(this.game.next).then((col) => {
      this.showEstimate(side, seat.agent);
      return col;
    });
  }

  /** Time the player of `side` has for each action. */
  private limitFor(side: Side): number | null {
    return this.seats[side].kind === "human" ? this.timeLimitMs : null;
  }

  /** (Re)starts the clock of the player to move; running out of time loses. */
  private startClock(limitMs: number | null): void {
    this.cancelTurnTimer?.();
    this.cancelTurnTimer = limitMs === null ? null : this.later(() => this.finish(this.game.timeout()), limitMs);
  }

  private makePush(col: number): void {
    this.cancelTurnTimer?.();
    this.cancelTurnTimer = null;
    const outcome = this.game.push(col);
    const seat = this.seats[outcome.side];
    // A computer player decides whether to push again while this push is animated.
    const again =
      seat.kind === "ai" && !outcome.result && !outcome.turnEnded
        ? seat.agent.pushAgain(this.game.next).then((pushAgain) => {
            this.showEstimate(outcome.side, seat.agent);
            return pushAgain;
          })
        : null;
    // When the push ends the turn, the next computer player starts thinking during its animation.
    if (outcome.turnEnded && !outcome.result) this.firstDecision = this.askFirstPush();
    this.showShift(outcome.side, col, outcome.inserted, this.game.next, outcome.pushes);
    this.update({ phase: "moving" });
    this.cancelPhase = this.later(() => this.afterPush(outcome, again), this.timing.pushMs);
  }

  private afterPush(outcome: PushOutcome, again: Promise<boolean> | null): void {
    this.showEffect(outcome.ejected, this.game.board);
    if (outcome.result) return this.finish(outcome.result);
    if (outcome.turnEnded) return this.startTurn();

    if (this.seats[outcome.side].kind === "human") {
      // The player decides: push again or end the turn, against a fresh clock.
      const limitMs = this.limitFor(outcome.side);
      this.showAwaiting(limitMs);
      return this.startClock(limitMs);
    }
    // The cool-down runs while the agent may still be thinking.
    const cooled = Date.now() + this.timing.coolMs;
    again?.then((pushAgain) => {
      if (this.stillDeciding(outcome.side, outcome.pushes)) this.continueTurn(outcome.col, pushAgain, Math.max(0, cooled - Date.now()));
    }, agentFailed);
  }

  /** A computer player's decision after a push. */
  private continueTurn(col: number, again: boolean, coolMs: number): void {
    if (!again) return this.nextTurn();
    this.update({ phase: "cooling" });
    this.cancelPhase = this.later(() => this.makePush(col), coolMs);
  }

  /** Shows the estimate of the agent playing `side`, as Green's chance of winning. */
  private showEstimate(side: Side, agent: AsyncAgent): void {
    if (this.disposed) return; // the agent is freed with the match
    const estimate = agent.winEstimate();
    if (estimate !== null) this.update({ winChance: side === Side.Left ? estimate : 1 - estimate });
  }

  /** Whether an agent's answer still applies: same turn, same number of pushes, match running. */
  private stillDeciding(side: Side, pushes: number): boolean {
    return !this.disposed && !this.game.over && this.game.turn === side && this.game.pushes === pushes;
  }

  private nextTurn(): void {
    this.game.endTurn();
    this.startTurn();
  }

  private finish(result: GameResult): void {
    this.cancelPhase?.();
    this.cancelTurnTimer?.();
    this.showResult(result);
  }
}

function agentFailed(error: unknown): void {
  console.error("Computer player failed", error);
}
