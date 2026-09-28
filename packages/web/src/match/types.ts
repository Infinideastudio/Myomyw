import type { Ball, GameResult, Side } from "@myomyw/engine";
import type { BallSprite, Cell, Ghost } from "./display.ts";

export type Phase =
  /** Not started yet (tutorial intro, waiting for an online opponent...). */
  | "waiting"
  /** A turn has started and its first push has not been made. */
  | "idle"
  /** A push is being animated / awaited. */
  | "moving"
  /** Between two pushes of the same turn. */
  | "cooling"
  | "over";

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
  chat: readonly ChatLine[];
}

/** What screens and components need from any kind of match. */
export interface MatchController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): MatchSnapshot;
  /** A human pressed (and is holding) an ejector of the side to move. */
  press(col: number): void;
  /** The human released the ejector. */
  release(): void;
  /** Stops all timers and connections. */
  dispose(): void;
}

/** Whether a human on this device may press an ejector right now. */
export function canPress(s: MatchSnapshot): boolean {
  return s.phase === "idle" && s.turn !== null && s.controllable[s.turn];
}
