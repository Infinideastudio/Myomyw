import { fileURLToPath } from "node:url";
import { RULES } from "@myomyw/engine";

/** Reads a time limit given in seconds; 0 means no limit. */
function limitMs(name: string, defaultMs: number): number | null {
  const value = process.env[name]?.trim();
  if (!value) return defaultMs;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`${name} must be a number of seconds (0 for no limit), got "${value}"`);
  return seconds > 0 ? Math.round(seconds * 1000) : null;
}

/** Server settings, overridable with environment variables. */
export const config = {
  /** TCP port for both HTTP (static files) and WebSocket traffic. */
  port: Number(process.env.PORT ?? 8650),
  host: process.env.HOST ?? "0.0.0.0",
  /** Maximum number of simultaneous games. */
  maxRooms: Number(process.env.MAX_ROOMS ?? 100),
  /** Message of the day, shown to players when they connect. */
  motd: process.env.MOTD ?? "",
  /**
   * Directory with the built web client, served over HTTP so a single process
   * hosts the whole game. Set STATIC_DIR="" to disable.
   */
  staticDir: process.env.STATIC_DIR ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
  /**
   * TIME_LIMIT: seconds a player has for each action — every push, and
   * ending the turn (20; 0 for no limit). Sent to clients when they connect.
   */
  timeLimitMs: limitMs("TIME_LIMIT", RULES.timeLimitMs),
  /** Connections must say hello within this time. */
  helloTimeoutMs: 10_000,
};
