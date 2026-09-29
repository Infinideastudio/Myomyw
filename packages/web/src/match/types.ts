import { RULES, Side, type Ball, type GameResult } from "@myomyw/engine";
import type { BallSprite, Cell, Ghost } from "./display.ts";

export type Phase =
  /** Not started yet (tutorial intro, waiting for an online opponent...). */
  | "waiting"
  /**
   * The player to move may act: make the first push of the turn, or (after
   * pushing) push the same line again or end the turn.
   */
  | "idle"
  /** A push is being animated / awaited. */
  | "moving"
  /** A computer player pauses between two pushes of the same turn. */
  | "cooling"
  | "over";

/** The clock of the player to move, restarted for each action. */
export interface TurnTimer {
  /** `performance.now()`-based time at which the current player runs out of time. */
  endsAt: number;
  totalMs: number;
}

/** Immutable picture of a match, rendered by the React components. */
export interface MatchSnapshot {
  names: readonly [string, string];
  /** Which sides this device may play (e.g. only Left against the computer). */
  controllable: readonly [boolean, boolean];
  lCol: number;
  rCol: number;
  balls: readonly BallSprite[];
  ghosts: readonly Ghost[];
  /** The most recently inserted ball, to animate it in from its ejector. */
  entering: { id: number; from: Cell } | null;
  /** Duration of the transition into this snapshot. */
  animMs: number;
  /** Increments each time the board is mirrored. */
  flips: number;
  phase: Phase;
  turn: Side | null;
  next: Ball | null;
  pushes: number;
  /** The line being pushed this turn. */
  activeLine: number | null;
  timer: TurnTimer | null;
  result: GameResult | null;
  /** Green's chance of winning (0–1) as estimated by the computer player that decided last, if it estimates. */
  winChance: number | null;
  /** Tutorial only: the current step. */
  tutorialStep?: number;
  /** Online only. */
  online?: OnlineInfo;
}

export type OnlineStatus = "connecting" | "matching" | "playing" | "over" | "error";

export type OnlineError = "connection" | "version" | "full" | "badName" | "badMessage" | "disconnected";

export interface ChatLine {
  from: "me" | "opponent" | "system";
  text: string;
}

export interface OnlineInfo {
  status: OnlineStatus;
  error: OnlineError | null;
  /** The side played on this device, once matched. */
  side: Side | null;
  room: number | null;
  motd: string;
  /** The server's time for each action (null: no limit); undefined until connected. */
  timeLimitMs?: number | null;
  chat: readonly ChatLine[];
}

/** What screens and components need from any kind of match. */
export interface MatchController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): MatchSnapshot;
  /** A human on this device pushes a line of the side to move (see {@link canPush}). */
  push(col: number): void;
  /** A human on this device ends the turn (see {@link canEndTurn}). */
  endTurn(): void;
  /** Stops all timers and connections. */
  dispose(): void;
}

/** Whether a human on this device may act right now. */
function humanToAct(s: MatchSnapshot): boolean {
  return s.phase === "idle" && s.turn !== null && s.controllable[s.turn];
}

/** Whether a human on this device may push line `col` now: any line first, then only the same one. */
export function canPush(s: MatchSnapshot, col: number): boolean {
  if (!humanToAct(s)) return false;
  if (s.pushes > 0) return col === s.activeLine && s.pushes < RULES.maxPushesPerTurn;
  return col >= 0 && col < (s.turn === Side.Left ? s.lCol : s.rCol);
}

/** Whether a human on this device may end the turn now (after pushing at least once). */
export function canEndTurn(s: MatchSnapshot): boolean {
  return humanToAct(s) && s.pushes > 0;
}
