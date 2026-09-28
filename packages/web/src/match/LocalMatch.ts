import { Game, RULES, type Agent, type Ball, type GameResult, type PushOutcome } from "@myomyw/core";
import { MatchBase } from "./MatchBase.ts";
import { NORMAL_TIMING, type Timing } from "./timing.ts";

/** Who plays a side in a local match. */
export type Seat =
  | { kind: "human" }
  | { kind: "ai"; agent: Agent }
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
 * push whether to continue.
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
        this.push(seat.agent.firstPush(this.game.next));
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
    const again = seat.kind === "human" ? this.holding : seat.kind === "ai" && seat.agent.pushAgain(this.game.next);
    if (!again) return this.endTurn();
    this.update({ phase: "cooling" });
    this.cancelPhase = this.later(() => this.push(outcome.col), this.timing.coolMs);
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
