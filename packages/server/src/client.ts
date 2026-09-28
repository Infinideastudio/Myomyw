import type { WebSocket } from "ws";
import { decode, encode, type ClientMessage, type ServerMessage } from "@myomyw/core";

let nextId = 1;

/** One connected player. Wraps the socket with typed send/receive. */
export class Client {
  readonly id = nextId++;
  name = "";
  private handler: ((message: ClientMessage) => void) | null = null;
  private readonly closeHandlers: (() => void)[] = [];

  private readonly ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on("message", (data) => {
      const message = decode<ClientMessage>(data.toString());
      if (message) this.handler?.(message);
    });
    ws.on("close", () => {
      for (const handler of this.closeHandlers) handler();
    });
  }

  get open(): boolean {
    return this.ws.readyState === this.ws.OPEN;
  }

  /** Replaces the message handler (the lobby hands clients over to rooms). */
  onMessage(handler: (message: ClientMessage) => void): void {
    this.handler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  send(message: ServerMessage): void {
    if (this.open) this.ws.send(encode(message));
  }

  close(): void {
    this.ws.close();
  }

  toString(): string {
    return `${this.name || "?"}#${this.id}`;
  }
}
