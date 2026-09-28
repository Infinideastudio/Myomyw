import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Ball, Side, type WasmGame } from "@myomyw/engine";
import { loadEngineSync } from "@myomyw/engine/node";
import { syncAgent } from "../src/ai/agents.ts";
import { engine, setEngine } from "../src/engine.ts";
import { LocalMatch } from "../src/match/LocalMatch.ts";
import { QUICK_TIMING } from "../src/match/timing.ts";

beforeAll(() => {
  setEngine(loadEngineSync());
});
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Plays a game between two agents directly on the engine, without timers or animation. */
function headless(seed: number): WasmGame {
  const agents = [engine().createAgent("hard", seed + 1), engine().createAgent("normal", seed + 2)];
  const game = engine().newGame({ seed });
  while (!game.over) {
    const agent = agents[game.turn]!;
    agent.beginTurn(game.view());
    const col = agent.firstPush(game.next);
    let outcome = game.push(col);
    while (!outcome.result && !outcome.turnEnded) {
      if (!agent.pushAgain(game.next)) {
        game.endTurn();
        break;
      }
      outcome = game.push(col);
    }
  }
  return game;
}

/** Runs a LocalMatch between two agents to completion on fake timers. */
async function runLocal(seed: number) {
  const match = new LocalMatch({
    seats: [
      { kind: "ai", agent: syncAgent(engine().createAgent("hard", seed + 1)) },
      { kind: "ai", agent: syncAgent(engine().createAgent("normal", seed + 2)) },
    ],
    names: ["A", "B"],
    timer: true,
    timing: QUICK_TIMING,
    seed,
  });
  for (let i = 0; i < 100_000 && match.getSnapshot().phase !== "over"; i++) await vi.advanceTimersByTimeAsync(50);
  return match;
}

describe("LocalMatch", () => {
  it("drives the AIs exactly like a direct game on the engine", async () => {
    for (let seed = 1; seed <= 5; seed++) {
      const expected = headless(seed);
      const snapshot = (await runLocal(seed)).getSnapshot();
      expect(snapshot.result).toEqual(expected.result);

      // The animated display ends in exactly the real final position.
      const board = expected.board;
      expect([snapshot.lCol, snapshot.rCol]).toEqual([board.lCol, board.rCol]);
      for (const sprite of snapshot.balls) expect(sprite.ball).toBe(board.cells[sprite.y]![sprite.x]);
      expect(snapshot.balls).toHaveLength(board.lCol * board.rCol);
    }
  });

  it("repeats pushes while an ejector is held and ends the turn on release", () => {
    const match = new LocalMatch({
      seats: [{ kind: "human" }, { kind: "ai", agent: syncAgent(engine().createAgent("easy")) }],
      names: ["Human", "AI"],
      timer: false,
      timing: QUICK_TIMING,
      ballSource: () => Ball.Common,
    });
    match.press(2);
    vi.advanceTimersByTime(QUICK_TIMING.pushMs + QUICK_TIMING.coolMs + QUICK_TIMING.pushMs + 10);
    expect(match.getSnapshot().pushes).toBe(2);
    match.release();
    vi.advanceTimersByTime(QUICK_TIMING.coolMs + 1);
    expect(match.getSnapshot().turn).toBe(Side.Right);
  });

  it("stops after 5 pushes even if the ejector is still held", () => {
    const match = new LocalMatch({
      seats: [{ kind: "human" }, { kind: "human" }],
      names: ["G", "B"],
      timer: false,
      timing: QUICK_TIMING,
      ballSource: () => Ball.Common,
    });
    match.press(0);
    vi.advanceTimersByTime(10 * (QUICK_TIMING.pushMs + QUICK_TIMING.coolMs));
    const s = match.getSnapshot();
    expect(s.turn).toBe(Side.Right);
    expect(s.phase).toBe("idle");
  });

  it("makes a player who does not push in time lose", () => {
    const match = new LocalMatch({ seats: [{ kind: "human" }, { kind: "human" }], names: ["G", "B"], timer: true });
    vi.advanceTimersByTime(20_001);
    expect(match.getSnapshot().result).toEqual({ winner: Side.Right, reason: "timeout" });
  });
});
