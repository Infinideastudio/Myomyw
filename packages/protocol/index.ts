/**
 * WebSocket protocol between the web client and the game server.
 * Every message is one JSON object with a `t` (type) field. See docs/protocol.md.
 */
import type { Ball, BoardSnapshot, EndReason, Side } from "@myomyw/engine";

export type { BoardSnapshot };

export const PROTOCOL_VERSION = 4;
export const MAX_NAME_LENGTH = 15;
export const MAX_CHAT_LENGTH = 200;

export type ClientMessage =
  | { t: "hello"; version: number; name: string }
  | { t: "push"; col: number }
  | { t: "endTurn" }
  | { t: "resign" }
  | { t: "chat"; text: string };

export type RejectReason = "version" | "full" | "badName" | "badMessage";

export type ServerMessage =
  /** `timeLimitMs`: the time for each action (a push, or ending the turn); `null` for no limit. */
  | { t: "welcome"; motd: string; timeLimitMs: number | null }
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
  /** A new turn begins. */
  | { t: "turn"; side: Side }
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
