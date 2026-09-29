import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { Ball, Side } from "@myomyw/engine";
import { PROTOCOL_VERSION, decode, encode, type ClientMessage, type ServerMessage, type TimeLimits } from "@myomyw/protocol";
import { createGameServer } from "../src/server.ts";

const LIMITS: TimeLimits = { turnMs: 20_000, pushIntervalMs: 5_000 };
const server = createGameServer("", LIMITS);
let url = "";

/** Starts a server on a free port and returns its URL. */
async function listen(s: Server): Promise<string> {
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  return `ws://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

function stop(s: Server): void {
  s.closeAllConnections();
  s.close();
}

beforeAll(async () => {
  url = await listen(server);
});
afterAll(() => stop(server));

/** Test client that records every message it receives. */
class TestClient {
  readonly ws: WebSocket;
  readonly inbox: ServerMessage[] = [];
  private waiters: (() => void)[] = [];

  constructor(serverUrl = url) {
    this.ws = new WebSocket(serverUrl);
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
    const [alice, bob] = await pair(url);
    const a = await alice.next("matched");
    const b = await bob.next("matched");
    expect(a.side).toBe(Side.Left);
    expect(b.side).toBe(Side.Right);
    expect(a.opponent).toBe("Bob");
    expect(a.next).toBe(b.next);
    expect(await alice.next("turn")).toEqual({ t: "turn", side: Side.Left, timeLimitMs: LIMITS.turnMs });

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

  it("enforces its turn time limit", async () => {
    const quick = createGameServer("", { turnMs: 100, pushIntervalMs: null });
    try {
      const [alice, bob] = await pair(await listen(quick), { turnMs: 100, pushIntervalMs: null });
      expect((await alice.next("turn")).timeLimitMs).toBe(100);
      expect(await bob.next("over")).toEqual({ t: "over", winner: Side.Right, reason: "timeout" });
    } finally {
      stop(quick);
    }
  });

  it("can play without time limits", async () => {
    const relaxed = createGameServer("", { turnMs: null, pushIntervalMs: null });
    try {
      const [alice] = await pair(await listen(relaxed), { turnMs: null, pushIntervalMs: null });
      expect((await alice.next("turn")).timeLimitMs).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(alice.inbox.some((m) => m.t === "over")).toBe(false);
    } finally {
      stop(relaxed);
    }
  });
});

/** Connects Alice then Bob, checking that both are told the server's time limits. */
async function pair(serverUrl: string, limits = LIMITS): Promise<[TestClient, TestClient]> {
  const alice = new TestClient(serverUrl);
  const bob = new TestClient(serverUrl);
  await Promise.all([alice.opened(), bob.opened()]);
  alice.send({ t: "hello", version: PROTOCOL_VERSION, name: "Alice" });
  expect((await alice.next("welcome")).timeLimits).toEqual(limits);
  bob.send({ t: "hello", version: PROTOCOL_VERSION, name: "Bob" });
  expect((await bob.next("welcome")).timeLimits).toEqual(limits);
  return [alice, bob];
}
