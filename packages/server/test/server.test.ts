import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { Ball, Side } from "@myomyw/engine";
import { PROTOCOL_VERSION, decode, encode, type ClientMessage, type ServerMessage } from "@myomyw/protocol";
import { createGameServer } from "../src/server.ts";

const server = createGameServer("");
let url = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

/** Test client that records every message it receives. */
class TestClient {
  readonly ws: WebSocket;
  readonly inbox: ServerMessage[] = [];
  private waiters: (() => void)[] = [];

  constructor() {
    this.ws = new WebSocket(url);
    this.ws.on("message", (data) => {
      this.inbox.push(decode<ServerMessage>(data.toString())!);
      for (const w of this.waiters.splice(0)) w();
    });
  }

  opened(): Promise<void> {
    return new Promise((resolve) => this.ws.once("open", () => resolve()));
  }

  send(message: ClientMessage): void {
    this.ws.send(encode(message));
  }

  /** Waits for (and consumes) the next message of type `t`. */
  async next<T extends ServerMessage["t"]>(t: T): Promise<Extract<ServerMessage, { t: T }>> {
    for (;;) {
      const index = this.inbox.findIndex((m) => m.t === t);
      if (index >= 0) return this.inbox.splice(0, index + 1)[index] as Extract<ServerMessage, { t: T }>;
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }
}

describe("game server", () => {
  it("rejects incompatible clients", async () => {
    const c = new TestClient();
    await c.opened();
    c.send({ t: "hello", version: PROTOCOL_VERSION + 100, name: "x" });
    expect(await c.next("rejected")).toEqual({ t: "rejected", reason: "version" });
  });

  it("matches two players and relays an authoritative game", async () => {
    const alice = new TestClient();
    const bob = new TestClient();
    await Promise.all([alice.opened(), bob.opened()]);
    alice.send({ t: "hello", version: PROTOCOL_VERSION, name: "Alice" });
    await alice.next("welcome");
    bob.send({ t: "hello", version: PROTOCOL_VERSION, name: "Bob" });
    await bob.next("welcome");

    const a = await alice.next("matched");
    const b = await bob.next("matched");
    expect(a.side).toBe(Side.Left);
    expect(b.side).toBe(Side.Right);
    expect(a.opponent).toBe("Bob");
    expect(a.next).toBe(b.next);
    expect((await alice.next("turn")).side).toBe(Side.Left);

    // Bob cannot move out of turn; Alice pushes line 2 and ends her turn.
    bob.send({ t: "push", col: 0 });
    alice.send({ t: "push", col: 2 });
    const pushed = await bob.next("pushed");
    expect(pushed).toMatchObject({ side: Side.Left, col: 2, inserted: a.next });
    expect(await alice.next("pushed")).toEqual(pushed);

    alice.send({ t: "chat", text: "  hi  " });
    expect(await bob.next("chat")).toEqual({ t: "chat", text: "hi" });

    if (pushed.ejected !== Ball.Flip) alice.send({ t: "endTurn" }); // a Flip ends the turn by itself
    expect((await bob.next("turn")).side).toBe(Side.Right);

    bob.send({ t: "resign" });
    expect(await alice.next("over")).toEqual({ t: "over", winner: Side.Left, reason: "resign" });
  });
});
