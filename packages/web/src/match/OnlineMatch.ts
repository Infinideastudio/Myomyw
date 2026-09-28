import { Ball, RULES, Side, opponent, type WasmBoard } from "@myomyw/engine";
import { MAX_CHAT_LENGTH, PROTOCOL_VERSION, decode, encode, type ClientMessage, type ServerMessage } from "@myomyw/protocol";
import { engine } from "../engine.ts";
import { MatchBase } from "./MatchBase.ts";
import { NORMAL_TIMING } from "./timing.ts";
import type { ChatLine, OnlineError, OnlineInfo } from "./types.ts";

/** How fast queued events are replayed when the client falls behind the server. */
const CATCH_UP_MS = 60;

/**
 * A match against a remote player. The server is authoritative; this class
 * sends the local player's intents, and replays the server's events in order,
 * one animation at a time, on the display board.
 *
 * A copy of the board is kept in the engine and every push is replayed on it,
 * which gives the resulting position for the display.
 *
 * The local player's hold-to-repeat works like offline: after our own push has
 * been shown (and a cool-down), we push again if the ejector is still held,
 * otherwise we end the turn.
 */
export class OnlineMatch extends MatchBase {
  private readonly ws: WebSocket;
  private readonly myName: string;
  private mySide: Side | null = null;
  private holding = false;
  private awaitingEcho = false;
  private cancelCool: (() => void) | null = null;
  private readonly queue: (() => number)[] = [];
  private busy = false;
  /** Set as soon as the result arrives (it is shown later, after queued animations). */
  private finished = false;
  /** The server's board, replayed push by push. */
  private mirror: WasmBoard | null = null;

  constructor(url: string, name: string) {
    super({ names: [name, "…"], controllable: [false, false], timing: NORMAL_TIMING });
    this.myName = name;
    this.update({ online: { status: "connecting", error: null, side: null, room: null, motd: "", chat: [] } });
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.send({ t: "hello", version: PROTOCOL_VERSION, name });
    this.ws.onmessage = (event) => {
      const message = decode<ServerMessage>(String(event.data));
      if (message) this.receive(message);
    };
    // The server closes the connection right after a game ends; that is not an error.
    const lost = () => {
      if (!this.finished && this.info.status !== "error") this.fail(this.info.status === "connecting" ? "connection" : "disconnected");
    };
    this.ws.onerror = lost;
    this.ws.onclose = lost;
  }

  override dispose(): void {
    super.dispose();
    this.ws.onclose = null;
    this.ws.close();
    this.mirror?.free();
  }

  press(col: number): void {
    const s = this.state;
    if (s.phase !== "idle" || s.turn === null || s.turn !== this.mySide || col < 0 || col >= this.lines(s.turn)) return;
    this.holding = true;
    this.sendPush(col);
  }

  release(): void {
    if (!this.holding) return;
    this.holding = false;
    if (this.state.phase === "cooling") {
      this.cancelCool?.();
      this.send({ t: "endTurn" });
      this.update({ phase: "moving" });
    }
  }

  resign(): void {
    this.send({ t: "resign" });
  }

  chat(text: string): void {
    const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!trimmed || this.info.status !== "playing") return;
    this.send({ t: "chat", text: trimmed });
    this.addChat({ from: "me", text: trimmed });
  }

  private get info(): OnlineInfo {
    return this.state.online!;
  }

  private setInfo(patch: Partial<OnlineInfo>): void {
    this.update({ online: { ...this.info, ...patch } });
  }

  private addChat(line: ChatLine): void {
    this.setInfo({ chat: [...this.info.chat, line] });
  }

  private lines(side: Side): number {
    return side === Side.Left ? this.state.lCol : this.state.rCol;
  }

  private send(message: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(encode(message));
  }

  private sendPush(col: number): void {
    this.awaitingEcho = true;
    this.send({ t: "push", col });
    this.update({ phase: "moving", timer: null });
  }

  private fail(error: OnlineError): void {
    this.holding = false;
    this.setInfo({ status: "error", error });
    this.update({ phase: this.state.phase === "over" ? "over" : "waiting", timer: null });
  }

  private receive(message: ServerMessage): void {
    switch (message.t) {
      case "welcome":
        this.setInfo({ status: "matching", motd: message.motd });
        break;
      case "rejected":
        this.fail(message.reason);
        break;
      case "matched": {
        this.mySide = message.side;
        const names: [string, string] = [this.myName, this.myName];
        names[opponent(message.side)] = message.opponent;
        const controllable: [boolean, boolean] = [false, false];
        controllable[message.side] = true;
        this.update({ names, controllable, next: message.next });
        this.mirror = engine().createBoard(message.board);
        this.resetBoard(message.board);
        this.setInfo({ status: "playing", side: message.side, room: message.room });
        break;
      }
      case "turn": {
        const receivedAt = performance.now();
        this.enqueue(() => {
          this.holding = false;
          const elapsed = performance.now() - receivedAt;
          this.showTurn(message.side, Math.max(0, message.timeLimitMs - elapsed));
          return 0;
        });
        break;
      }
      case "pushed":
        this.enqueue(() => this.showPush(message));
        break;
      case "over":
        this.finished = true;
        this.enqueue(() => {
          this.holding = false;
          this.showResult({ winner: message.winner, reason: message.reason });
          this.setInfo({ status: "over" });
          return 0;
        });
        break;
      case "chat":
        this.addChat({ from: "opponent", text: message.text });
        break;
    }
  }

  private showPush(message: Extract<ServerMessage, { t: "pushed" }>): number {
    this.showShift(message.side, message.col, message.inserted, message.next, this.state.pushes + 1);
    if (this.mirror!.push(message.side, message.col, message.inserted) !== message.ejected) console.warn("Board out of sync with the server");
    const mine = message.side === this.mySide;
    if (mine) this.awaitingEcho = false;
    this.update({ phase: "moving" });
    // The effect is shown once the push animation is over.
    this.queue.unshift(() => {
      this.showEffect(message.ejected, this.mirror!.read());
      const turnGoesOn = message.ejected !== Ball.Key && message.ejected !== Ball.Flip && this.state.pushes < RULES.maxPushesPerTurn;
      if (mine && turnGoesOn) this.continueOwnTurn(message.col);
      return 0;
    });
    return this.timing.pushMs;
  }

  /** After our own push: push again while the ejector is held, else end the turn. */
  private continueOwnTurn(col: number): void {
    if (!this.holding) {
      this.send({ t: "endTurn" });
      return;
    }
    this.update({ phase: "cooling" });
    this.cancelCool = this.later(() => {
      if (this.holding && !this.awaitingEcho) this.sendPush(col);
    }, this.timing.coolMs);
  }

  /** Runs display steps one after another; each returns how long it animates. */
  private enqueue(step: () => number): void {
    this.queue.push(step);
    if (!this.busy) this.pump();
  }

  private pump(): void {
    const step = this.queue.shift();
    if (!step) {
      this.busy = false;
      return;
    }
    this.busy = true;
    const ms = step();
    const wait = this.queue.length > 1 ? Math.min(ms, CATCH_UP_MS) : ms;
    if (wait > 0) this.later(() => this.pump(), wait);
    else this.pump();
  }
}
