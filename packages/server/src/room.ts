import {
  Game,
  MAX_CHAT_LENGTH,
  PUSH_INTERVAL_LIMIT_MS,
  RULES,
  Side,
  opponent,
  type ClientMessage,
  type GameResult,
  type ServerMessage,
} from "@myomyw/core";
import type { Client } from "./client.ts";

/**
 * One online game. The server is authoritative: it owns the {@link Game},
 * draws the balls, enforces the timers and broadcasts every change. Clients
 * only send intents (push / end turn / resign / chat).
 *
 * Timers:
 * - a turn's first push must come within RULES.turnTimeLimitMs;
 * - after a push, the next push or "end turn" must come within
 *   PUSH_INTERVAL_LIMIT_MS (clients auto-repeat faster than that while the
 *   ejector is held, so this only catches stalled clients).
 * Running out of either timer loses the game.
 */
export class Room {
  readonly id: number;
  private readonly game = new Game();
  private readonly players: readonly [Client, Client];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly onClose: () => void;

  constructor(id: number, left: Client, right: Client, onClose: () => void) {
    this.id = id;
    this.players = [left, right];
    this.onClose = onClose;
    for (const side of [Side.Left, Side.Right]) {
      const client = this.players[side];
      client.onMessage((message) => this.handle(side, message));
      client.onClose(() => this.finish(this.game.forfeit(side, "disconnect")));
      client.send({
        t: "matched",
        room: id,
        side,
        opponent: this.players[opponent(side)].name,
        board: { cells: this.game.board.cells, lCol: this.game.board.lCol, rCol: this.game.board.rCol },
        next: this.game.next,
        turn: this.game.turn,
      });
    }
    this.beginTurn();
  }

  private handle(side: Side, message: ClientMessage): void {
    if (this.closed) return;
    switch (message.t) {
      case "push":
        if (side === this.game.turn && this.game.canPush(message.col)) this.push(message.col);
        break;
      case "endTurn":
        if (side === this.game.turn && this.game.canEndTurn()) {
          this.game.endTurn();
          this.beginTurn();
        }
        break;
      case "resign":
        this.finish(this.game.forfeit(side, "resign"));
        break;
      case "chat": {
        const text = typeof message.text === "string" ? message.text.trim().slice(0, MAX_CHAT_LENGTH) : "";
        if (text) this.players[opponent(side)].send({ t: "chat", text });
        break;
      }
    }
  }

  private push(col: number): void {
    const outcome = this.game.push(col);
    this.broadcast({
      t: "pushed",
      side: outcome.side,
      col: outcome.col,
      inserted: outcome.inserted,
      ejected: outcome.ejected,
      next: this.game.next,
    });
    if (outcome.result) this.finish(outcome.result);
    else if (outcome.turnEnded) this.beginTurn();
    else this.startTimer(PUSH_INTERVAL_LIMIT_MS);
  }

  private beginTurn(): void {
    this.broadcast({ t: "turn", side: this.game.turn, timeLimitMs: RULES.turnTimeLimitMs });
    this.startTimer(RULES.turnTimeLimitMs);
  }

  private startTimer(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.finish(this.game.timeout()), ms);
  }

  private finish(result: GameResult): void {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.broadcast({ t: "over", winner: result.winner, reason: result.reason });
    for (const client of this.players) client.close();
    console.log(`room ${this.id}: ${this.players[result.winner]} beat ${this.players[opponent(result.winner)]} (${result.reason})`);
    this.onClose();
  }

  private broadcast(message: ServerMessage): void {
    for (const client of this.players) client.send(message);
  }
}
