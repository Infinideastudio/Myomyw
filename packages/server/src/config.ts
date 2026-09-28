import { fileURLToPath } from "node:url";

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
  /** Connections must say hello within this time. */
  helloTimeoutMs: 10_000,
};
