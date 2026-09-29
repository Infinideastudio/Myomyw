import { RULES, Side, type Ball, type GameResult, type PushOutcome, type WasmGame } from "@myomyw/engine";
import type { AsyncAgent } from "../ai/agents.ts";
import { engine } from "../engine.ts";
import { MatchBase } from "./MatchBase.ts";
import { NORMAL_TIMING, type Timing } from "./timing.ts";

/** Who plays a side in a local match. */
export type Seat =
  | { kind: "human" }
  | { kind: "ai"; agent: AsyncAgent }
  /** Nobody: the side never moves (used by the tutorial). */
  | { kind: "idle" };

export interface LocalMatchOptions {
  seats: readonly [Seat, Seat];
  names: readonly [string, string];
  /** Enforce the 20-second limit for the first push of each turn. */
  timer: boolean;
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
 * `WasmGame` of the engine)
 * and paces it like the original game:
 *
 *   press → push (animated) → [hold? cool down → push again] → release → next turn
 *
 * A computer player follows the same rhythm. It is asked for its first push
 * when its turn starts and whether to push again as soon as each push is made,
 * so it thinks during the pause before its turn and during the push animation
 * and the cool-down after it: a decision only delays the game if it takes
 * longer than those. Agents answer asynchronously (they may think in a Web
 * Worker); answers that arrive after the situation changed are ignored.
 */
export class LocalMatch extends MatchBase {
  protected readonly game: WasmGame;
  private readonly seats: readonly [Seat, Seat];
  private readonly timerEnabled: boolean;
  private holding = false;
  private cancelPhase: (() => void) | null = null;
  private cancelTurnTimer: (() => void) | null = null;

  constructor(options: LocalMatchOptions) {
    const timing = options.timing ?? NORMAL_TIMING;
    const human = (seat: Seat) => seat.kind === "human";
    super({ names: options.names, controllable: [human(options.seats[0]), human(options.seats[1])], timing });
    this.seats = options.seats;
    this.timerEnabled = options.timer;
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

  press(col: number): void {
    if (this.state.phase !== "idle" || this.seats[this.game.turn].kind !== "human" || !this.game.canPush(col)) return;
    this.holding = true;
    this.push(col);
  }

  release(): void {
    if (!this.holding) return;
    this.holding = false;
    if (this.state.phase === "cooling") {
      this.cancelPhase?.();
      this.endTurn();
    }
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
    this.holding = false;
    const side = this.game.turn;
    this.showTurn(side, this.timerEnabled ? RULES.turnTimeLimitMs : null);
    this.cancelTurnTimer?.();
    this.cancelTurnTimer = this.timerEnabled ? this.later(() => this.finish(this.game.timeout()), RULES.turnTimeLimitMs) : null;
    const seat = this.seats[side];
    if (seat.kind === "ai") {
      seat.agent.beginTurn(this.game.view());
      const decision = seat.agent.firstPush(this.game.next).then((col) => {
        this.showEstimate(side, seat.agent);
        return col;
      });
      this.cancelPhase = this.later(() => {
        decision.then((col) => {
          if (this.stillDeciding(side, 0)) this.push(col);
        }, agentFailed);
      }, this.timing.aiThinkMs);
    }
    this.onTurnStart();
  }

  private push(col: number): void {
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
    this.showShift(outcome.side, col, outcome.inserted, this.game.next, outcome.pushes);
    this.update({ phase: "moving" });
    this.cancelPhase = this.later(() => this.afterPush(outcome, again), this.timing.pushMs);
  }

  private afterPush(outcome: PushOutcome, again: Promise<boolean> | null): void {
    this.showEffect(outcome.ejected, this.game.board);
    if (outcome.result) return this.finish(outcome.result);
    if (outcome.turnEnded) return this.startTurn();

    if (this.seats[outcome.side].kind === "human") return this.continueTurn(outcome.col, this.holding, this.timing.coolMs);
    // The cool-down runs while the agent may still be thinking.
    const cooled = Date.now() + this.timing.coolMs;
    again?.then((pushAgain) => {
      if (this.stillDeciding(outcome.side, outcome.pushes)) this.continueTurn(outcome.col, pushAgain, Math.max(0, cooled - Date.now()));
    }, agentFailed);
  }

  private continueTurn(col: number, again: boolean, coolMs: number): void {
    if (!again) return this.endTurn();
    this.update({ phase: "cooling" });
    this.cancelPhase = this.later(() => this.push(col), coolMs);
  }

  /** Shows the estimate of the agent playing `side`, as Green's chance of winning. */
  private showEstimate(side: Side, agent: AsyncAgent): void {
    const estimate = agent.winEstimate();
    if (estimate !== null) this.update({ winChance: side === Side.Left ? estimate : 1 - estimate });
  }

  /** Whether an agent's answer still applies: same turn, same number of pushes, match running. */
  private stillDeciding(side: Side, pushes: number): boolean {
    return !this.disposed && !this.game.over && this.game.turn === side && this.game.pushes === pushes;
  }

  private endTurn(): void {
    this.game.endTurn();
    this.startTurn();
  }

  private finish(result: GameResult): void {
    this.cancelPhase?.();
    this.cancelTurnTimer?.();
    this.holding = false;
    this.showResult(result);
  }
}

function agentFailed(error: unknown): void {
  console.error("Computer player failed", error);
}
