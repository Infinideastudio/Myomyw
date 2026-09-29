import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Ball, Side, type WasmGame } from "@myomyw/engine";
import { loadEngineSync } from "@myomyw/engine/node";
import { syncAgent, type AsyncAgent } from "../src/ai/agents.ts";
import { engine, setEngine } from "../src/engine.ts";
import { LocalMatch } from "../src/match/LocalMatch.ts";
import { NORMAL_TIMING, QUICK_TIMING } from "../src/match/timing.ts";

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
    timeLimitMs: 20_000,
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

  it("pushes once per click, on the same line only, until the player ends the turn", () => {
    const match = new LocalMatch({
      seats: [{ kind: "human" }, { kind: "ai", agent: syncAgent(engine().createAgent("easy")) }],
      names: ["Human", "AI"],
      timeLimitMs: null,
      timing: QUICK_TIMING,
      ballSource: () => Ball.Common,
    });
    match.endTurn(); // must push at least once
    match.push(2);
    match.push(2); // ignored while the push is animated
    vi.advanceTimersByTime(QUICK_TIMING.pushMs);
    expect(match.getSnapshot()).toMatchObject({ phase: "idle", pushes: 1, activeLine: 2, turn: Side.Left });
    match.push(3); // another line
    vi.advanceTimersByTime(QUICK_TIMING.pushMs);
    expect(match.getSnapshot().pushes).toBe(1);
    match.push(2);
    vi.advanceTimersByTime(QUICK_TIMING.pushMs);
    expect(match.getSnapshot().pushes).toBe(2);
    match.endTurn();
    expect(match.getSnapshot().turn).toBe(Side.Right);
    match.dispose();
  });

  it("ends the turn by itself after 5 pushes", () => {
    const match = new LocalMatch({
      seats: [{ kind: "human" }, { kind: "human" }],
      names: ["G", "B"],
      timeLimitMs: null,
      timing: QUICK_TIMING,
      ballSource: () => Ball.Common,
    });
    for (let i = 0; i < 5; i++) {
      match.push(0);
      vi.advanceTimersByTime(QUICK_TIMING.pushMs);
    }
    expect(match.getSnapshot()).toMatchObject({ turn: Side.Right, phase: "idle", pushes: 0 });
  });

  it("lets the computer start thinking as soon as the human's turn ends, during the push animation", () => {
    let asked = 0;
    const agent: AsyncAgent = {
      beginTurn: () => {},
      firstPush: () => {
        asked++;
        return new Promise<number>(() => {});
      },
      pushAgain: () => Promise.resolve(false),
      winEstimate: () => null,
      dispose: () => {},
    };
    const match = new LocalMatch({
      seats: [{ kind: "human" }, { kind: "ai", agent }],
      names: ["Human", "AI"],
      timeLimitMs: null,
      timing: NORMAL_TIMING,
      ballSource: () => Ball.Common,
    });
    for (let i = 0; i < 4; i++) {
      match.push(0);
      vi.advanceTimersByTime(NORMAL_TIMING.pushMs);
    }
    expect(asked).toBe(0);
    match.push(0); // the 5th push ends the turn
    expect(match.getSnapshot().phase).toBe("moving");
    expect(asked).toBe(1);
    vi.advanceTimersByTime(NORMAL_TIMING.pushMs);
    expect(match.getSnapshot().turn).toBe(Side.Right);
    expect(asked).toBe(1); // not asked twice
    match.dispose();
  });

  it("lets a computer player think during the pause, the animation and the cool-down", async () => {
    const after = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
    let asked = 0;
    // Every decision takes 600 ms: push line 0, push again once, then stop.
    const slow: AsyncAgent = {
      beginTurn: () => {},
      firstPush: () => after(600, 0),
      pushAgain: () => after(600, ++asked === 1),
      winEstimate: () => 0.7,
      dispose: () => {},
    };
    const match = new LocalMatch({
      seats: [{ kind: "ai", agent: slow }, { kind: "human" }],
      names: ["AI", "Human"],
      timeLimitMs: null,
      timing: NORMAL_TIMING,
      ballSource: () => Ball.Common,
    });
    const { aiThinkMs, pushMs, coolMs } = NORMAL_TIMING;
    expect(match.getSnapshot().winChance).toBe(null);
    await vi.advanceTimersByTimeAsync(aiThinkMs - 1);
    expect(match.getSnapshot().pushes).toBe(0);
    // The AI plays Green, so its estimate is Green's chance.
    expect(match.getSnapshot().winChance).toBe(0.7);
    await vi.advanceTimersByTimeAsync(1);
    expect(match.getSnapshot().pushes).toBe(1);
    await vi.advanceTimersByTimeAsync(pushMs + coolMs - 1);
    expect(match.getSnapshot().pushes).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(match.getSnapshot().pushes).toBe(2);
    await vi.advanceTimersByTimeAsync(pushMs + 600);
    expect(match.getSnapshot().turn).toBe(Side.Right);
    match.dispose();
  });

  it("makes a player who does not push in time lose", () => {
    const match = new LocalMatch({ seats: [{ kind: "human" }, { kind: "human" }], names: ["G", "B"], timeLimitMs: 10_000 });
    expect(match.getSnapshot().timer?.totalMs).toBe(10_000);
    vi.advanceTimersByTime(9_999);
    expect(match.getSnapshot().result).toBe(null);
    vi.advanceTimersByTime(2);
    expect(match.getSnapshot().result).toEqual({ winner: Side.Right, reason: "timeout" });
  });

  it("times each action separately", () => {
    const match = new LocalMatch({ seats: [{ kind: "human" }, { kind: "human" }], names: ["G", "B"], timeLimitMs: 10_000, ballSource: () => Ball.Common });
    vi.advanceTimersByTime(9_000);
    match.push(0);
    vi.advanceTimersByTime(NORMAL_TIMING.pushMs);
    expect(match.getSnapshot().timer?.totalMs).toBe(10_000);
    // Deciding whether to push again or end the turn has its own 10 s.
    vi.advanceTimersByTime(9_999);
    expect(match.getSnapshot().result).toBe(null);
    vi.advanceTimersByTime(2);
    expect(match.getSnapshot().result).toEqual({ winner: Side.Right, reason: "timeout" });
  });

  it("does not time players when there is no time limit", () => {
    const match = new LocalMatch({ seats: [{ kind: "human" }, { kind: "human" }], names: ["G", "B"], timeLimitMs: null });
    expect(match.getSnapshot().timer).toBe(null);
    vi.advanceTimersByTime(10 * 60_000);
    expect(match.getSnapshot().result).toBe(null);
  });

  it("never times a computer player", async () => {
    const never: AsyncAgent = {
      beginTurn: () => {},
      firstPush: () => new Promise<number>(() => {}),
      pushAgain: () => new Promise<boolean>(() => {}),
      winEstimate: () => null,
      dispose: () => {},
    };
    const match = new LocalMatch({ seats: [{ kind: "ai", agent: never }, { kind: "human" }], names: ["AI", "Human"], timeLimitMs: 1_000 });
    expect(match.getSnapshot().timer).toBe(null);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(match.getSnapshot().result).toBe(null);
    match.dispose();
  });
});
