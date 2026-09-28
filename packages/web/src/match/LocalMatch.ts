import { Game, RULES, type Ball, type GameResult, type PushOutcome, type Side } from "@myomyw/core";
import type { AsyncAgent } from "../ai/agents.ts";
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
  ballSource?: () => Ball;
  /** Start immediately (default true). Otherwise call {@link start}. */
  autoStart?: boolean;
}

/**
 * A match played entirely on this device: two humans, human vs computer,
 * computer vs computer, or the tutorial. Owns the authoritative {@link Game}
 * and paces it like the original game:
 *
 *   press → push (animated) → [hold? cool down → push again] → release → next turn
 *
 * A computer player follows the same rhythm, asking its agent after every
 * push whether to continue. Agents answer asynchronously (they may think in a
 * Web Worker); answers that arrive after the situation changed are ignored.
 */
export class LocalMatch extends MatchBase {
  protected readonly game: Game;
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
    this.game = new Game({ ballSource: options.ballSource });
    this.update({ next: this.game.next });
    if (options.autoStart ?? true) this.start();
  }

  override dispose(): void {
    super.dispose();
    for (const seat of this.seats) if (seat.kind === "ai") seat.agent.dispose();
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
      this.cancelPhase = this.later(() => {
        seat.agent.beginTurn(this.game.board.viewFor(side));
        seat.agent.firstPush(this.game.next).then((col) => {
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
    this.showShift(outcome.side, col, outcome.inserted, this.game.next, outcome.pushes);
    this.update({ phase: "moving" });
    this.cancelPhase = this.later(() => this.afterPush(outcome), this.timing.pushMs);
  }

  private afterPush(outcome: PushOutcome): void {
    this.showEffect(outcome.side, outcome.ejected);
    if (outcome.result) return this.finish(outcome.result);
    if (outcome.turnEnded) return this.startTurn();

    const seat = this.seats[outcome.side];
    if (seat.kind === "human") return this.continueTurn(outcome.col, this.holding);
    if (seat.kind === "ai") {
      seat.agent.pushAgain(this.game.next).then((again) => {
        if (this.stillDeciding(outcome.side, outcome.pushes)) this.continueTurn(outcome.col, again);
      }, agentFailed);
    }
  }

  private continueTurn(col: number, again: boolean): void {
    if (!again) return this.endTurn();
    this.update({ phase: "cooling" });
    this.cancelPhase = this.later(() => this.push(col), this.timing.coolMs);
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
