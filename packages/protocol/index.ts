/**
 * WebSocket protocol between the web client and the game server.
 * Every message is one JSON object with a `t` (type) field. See docs/protocol.md.
 */
import type { Ball, BoardSnapshot, EndReason, Side } from "@myomyw/engine";

export type { BoardSnapshot };

export const PROTOCOL_VERSION = 3;
export const MAX_NAME_LENGTH = 15;
export const MAX_CHAT_LENGTH = 200;
/** Default limit, online: after a push, the player must push again or end the turn within this time. */
export const PUSH_INTERVAL_LIMIT_MS = 5_000;

/** A server's time limits, in milliseconds; `null` means no limit. */
export interface TimeLimits {
  /** From the start of a turn until its first push. */
  turnMs: number | null;
  /** After a push, until the next push or the end of the turn. */
  pushIntervalMs: number | null;
}

export type ClientMessage =
  | { t: "hello"; version: number; name: string }
  | { t: "push"; col: number }
  | { t: "endTurn" }
  | { t: "resign" }
  | { t: "chat"; text: string };

export type RejectReason = "version" | "full" | "badName" | "badMessage";

export type ServerMessage =
  | { t: "welcome"; motd: string; timeLimits: TimeLimits }
  | { t: "rejected"; reason: RejectReason }
  | {
      t: "matched";
      room: number;
      /** The side this client plays. */
      side: Side;
      opponent: string;
      board: BoardSnapshot;
      next: Ball;
      turn: Side;
    }
  /** A push by either player (echoed to the pusher too). */
  | { t: "pushed"; side: Side; col: number; inserted: Ball; ejected: Ball; next: Ball }
  /** A new turn begins; `timeLimitMs` is the time for its first push (`null`: no limit). */
  | { t: "turn"; side: Side; timeLimitMs: number | null }
  | { t: "over"; winner: Side; reason: EndReason }
  | { t: "chat"; text: string };

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

/** Parses a message; returns null for anything malformed. Field validation is up to the receiver. */
export function decode<T extends ClientMessage | ServerMessage>(data: string): T | null {
  try {
    const value: unknown = JSON.parse(data);
    if (typeof value === "object" && value !== null && typeof (value as { t?: unknown }).t === "string") return value as T;
  } catch {
    // fall through
  }
  return null;
}
