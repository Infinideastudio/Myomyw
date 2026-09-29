import { Side, opponent, type GameResult } from "@myomyw/engine";
import { MAX_CHAT_LENGTH, type ClientMessage, type ServerMessage } from "@myomyw/protocol";
import type { Client } from "./client.ts";
import { engine } from "./engine.ts";

/**
 * One online game. The server is authoritative: it owns the game (a
 * `WasmGame` of the engine),
 * draws the balls, enforces the timers and broadcasts every change. Clients
 * only send intents (push / end turn / resign / chat).
 *
 * Every action is timed (unless the time limit is null): a turn's first push
 * must come within `timeLimitMs` of the turn starting, and after each push
 * the next push or "end turn" within `timeLimitMs` of that push. Running out
 * of time loses the game.
 */
export class Room {
  readonly id: number;
  private readonly game = engine.newGame();
  private readonly players: readonly [Client, Client];
  private readonly timeLimitMs: number | null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly onClose: () => void;

  constructor(id: number, left: Client, right: Client, timeLimitMs: number | null, onClose: () => void) {
    this.id = id;
    this.players = [left, right];
    this.timeLimitMs = timeLimitMs;
    this.onClose = onClose;
    for (const side of [Side.Left, Side.Right]) {
      const client = this.players[side];
      client.onMessage((message) => this.handle(side, message));
      client.onClose(() => {
        // Sockets are closed by `finish` too; only a disconnect during the game counts.
        if (!this.closed) this.finish(this.game.forfeit(side, "disconnect"));
      });
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
    else this.startTimer();
  }

  private beginTurn(): void {
    this.broadcast({ t: "turn", side: this.game.turn });
    this.startTimer();
  }

  /** Restarts the clock for the next action of the player to move. */
  private startTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    const ms = this.timeLimitMs;
    this.timer = ms === null ? null : setTimeout(() => this.finish(this.game.timeout()), ms);
  }

  private finish(result: GameResult): void {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.broadcast({ t: "over", winner: result.winner, reason: result.reason });
    for (const client of this.players) client.close();
    console.log(`room ${this.id}: ${this.players[result.winner]} beat ${this.players[opponent(result.winner)]} (${result.reason})`);
    this.game.free();
    this.onClose();
  }

  private broadcast(message: ServerMessage): void {
    for (const client of this.players) client.send(message);
  }
}
