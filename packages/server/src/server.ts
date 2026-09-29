import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import type { TimeLimits } from "@myomyw/protocol";
import { Client } from "./client.ts";
import { config } from "./config.ts";
import { Lobby } from "./lobby.ts";
import { serveStatic } from "./static.ts";

/** Creates (but does not start) the HTTP + WebSocket game server. */
export function createGameServer(staticDir: string, timeLimits: TimeLimits = config.timeLimits): Server {
  const http = createServer((req, res) => {
    try {
      if (staticDir && serveStatic(staticDir, req, res)) return;
    } catch {
      res.writeHead(400).end();
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Myomyw server: WebSocket endpoint only (no web client build found).\n");
  });
  const lobby = new Lobby(timeLimits);
  const wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws) => lobby.admit(new Client(ws)));
  http.on("close", () => wss.close());
  return http;
}
