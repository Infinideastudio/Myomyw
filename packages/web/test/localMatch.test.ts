import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Side, StrongAI, WeakAI, playMatch, randomBall, seededRng, type PushOutcome } from "@myomyw/core";
import { syncAgent } from "../src/ai/agents.ts";
import { LocalMatch } from "../src/match/LocalMatch.ts";
import { QUICK_TIMING } from "../src/match/timing.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Runs a LocalMatch between two agents to completion on fake timers. */
async function runLocal(seed: number, withTimer: boolean) {
  const balls = seededRng(seed);
  const match = new LocalMatch({
    seats: [
      { kind: "ai", agent: syncAgent(new StrongAI(2, 10, seededRng(seed + 1))) },
      { kind: "ai", agent: syncAgent(new StrongAI(1, 10, seededRng(seed + 2))) },
    ],
    names: ["A", "B"],
    timer: withTimer,
    timing: QUICK_TIMING,
    ballSource: () => randomBall(balls),
  });
  for (let i = 0; i < 100_000 && match.getSnapshot().phase !== "over"; i++) await vi.advanceTimersByTimeAsync(50);
  return match;
}

describe("LocalMatch", () => {
  it("drives AIs exactly like the headless playMatch", async () => {
    for (let seed = 1; seed <= 5; seed++) {
      const pushes: PushOutcome[] = [];
      const headless = playMatch(new StrongAI(2, 10, seededRng(seed + 1)), new StrongAI(1, 10, seededRng(seed + 2)), {
        rng: seededRng(seed),
        onPush: (o) => pushes.push(o),
      });
      const local = await runLocal(seed, true);
      const snapshot = local.getSnapshot();
      expect(snapshot.result).toEqual(headless.game.result);

      // The animated display ends in exactly the real final position.
      const board = headless.game.board;
      expect([snapshot.lCol, snapshot.rCol]).toEqual([board.lCol, board.rCol]);
      for (const sprite of snapshot.balls) expect(sprite.ball).toBe(board.cells[sprite.y]![sprite.x]);
      expect(snapshot.balls).toHaveLength(board.lCol * board.rCol);
      expect(pushes.length).toBeGreaterThan(0);
    }
  });

  it("repeats pushes while an ejector is held and ends the turn on release", () => {
    const match = new LocalMatch({
      seats: [{ kind: "human" }, { kind: "ai", agent: syncAgent(new WeakAI()) }],
      names: ["Human", "AI"],
      timer: false,
      timing: QUICK_TIMING,
      ballSource: () => 0,
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
      ballSource: () => 0,
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
