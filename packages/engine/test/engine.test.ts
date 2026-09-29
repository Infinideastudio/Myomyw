/**
 * Tests of the WebAssembly build and its TypeScript bindings.
 * Requires `npm run build:wasm` (run automatically by `npm test`).
 */
import { describe, expect, it } from "vitest";
import { Ball, IllegalMoveError, RULES, Side, type BoardSnapshot } from "../js/index.ts";
import { loadEngineSync } from "../js/node.ts";
import { loadLegacy } from "./legacy.ts";

const engine = loadEngineSync();

/** mulberry32, for test randomness independent of the engine. */
function testRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const initialBoard = (): BoardSnapshot => ({
  cells: Array.from({ length: RULES.maxCols }, () => Array<Ball>(RULES.maxCols).fill(Ball.Common)),
  lCol: RULES.initialCols,
  rCol: RULES.initialCols,
});

describe("rules", () => {
  it("move balls and apply effects exactly like the original game (Beta 0.8 GameNode.js)", () => {
    const legacy = loadLegacy();
    const rng = testRng(12345);
    for (let game = 0; game < 200; game++) {
      const board = engine.createBoard(initialBoard());
      const node = new legacy.GameNode(initialBoard().cells, RULES.initialCols, RULES.initialCols);
      for (let step = 0; step < 300; step++) {
        const side = (rng() < 0.5 ? Side.Left : Side.Right) as Side;
        const col = Math.floor(rng() * (side === Side.Left ? node.lCol : node.rCol));
        const ball = Math.floor(rng() * 5) as Ball;
        expect(board.push(side, col, ball)).toBe(node.moveOnce(side, col, ball));
      }
      // The original keeps stale balls outside the board; only the board itself must match.
      const copy = board.read();
      expect([copy.lCol, copy.rCol]).toEqual([node.lCol, node.rCol]);
      for (let l = 0; l < node.lCol; l++) expect(copy.cells[l]!.slice(0, node.rCol)).toEqual(node.chessmen[l]!.slice(0, node.rCol));
      board.free();
    }
  });
});

describe("WasmGame", () => {
  it("runs turns: same line, at most 5 pushes, stop after pushing", () => {
    const game = engine.newGame({ seed: 1, ballSource: () => Ball.Common });
    expect([game.turn, game.board.lCol, game.board.rCol, game.pushes, game.column]).toEqual([Side.Left, 6, 6, 0, null]);
    expect(() => game.endTurn()).toThrow(IllegalMoveError);
    expect(() => game.push(6)).toThrow(IllegalMoveError);
    for (let i = 1; i < RULES.maxPushesPerTurn; i++) {
      expect(game.push(3)).toMatchObject({ side: Side.Left, col: 3, pushes: i, turnEnded: false, result: null });
      expect(game.canPush(2)).toBe(false);
    }
    expect(game.push(3).turnEnded).toBe(true);
    expect(game.turn).toBe(Side.Right);
    game.push(0);
    game.endTurn();
    expect(game.turn).toBe(Side.Left);
    game.free();
  });

  it("reports the inserted and ejected balls, and a Key ends the game", () => {
    const balls = [Ball.Flip, Ball.Key, Ball.Common];
    const game = engine.newGame({ ballSource: () => balls.shift() ?? Ball.Common });
    game.setBall(0, 5, Ball.Key);
    const outcome = game.push(0);
    expect(outcome).toMatchObject({ inserted: Ball.Flip, ejected: Ball.Key, result: { winner: Side.Right, reason: "key" } });
    expect(game.board.cells[0]![0]).toBe(Ball.Flip);
    expect(game.next).toBe(Ball.Key);
    expect(game.over).toBe(true);
    expect(game.canPush(0)).toBe(false);
  });

  it("gives agents the board from the mover's side", () => {
    const game = engine.newGame({ ballSource: () => Ball.Common });
    game.setBall(1, 4, Ball.Key);
    game.push(0);
    game.endTurn();
    expect(game.view().cells[4]![1]).toBe(Ball.Key);
    expect(game.board.cells[1]![4]).toBe(Ball.Key);
  });

  it("draws the same balls for the same seed", () => {
    const play = (seed: number) => {
      const game = engine.newGame({ seed });
      const balls = [game.next];
      for (let i = 0; i < 20 && !game.over; i++) {
        game.push(0);
        balls.push(game.next);
        if (!game.over && game.canEndTurn()) game.endTurn();
      }
      return balls;
    };
    expect(play(7)).toEqual(play(7));
    expect(play(7)).not.toEqual(play(8));
  });

  it("handles timeouts and forfeits", () => {
    const game = engine.newGame();
    expect(game.timeout()).toEqual({ winner: Side.Right, reason: "timeout" });
    expect(engine.newGame().forfeit(Side.Right, "disconnect")).toEqual({ winner: Side.Left, reason: "disconnect" });
  });
});

describe("WasmAgent", () => {
  /** Plays a full game between two agent specs; returns the winner and every decision. */
  function play(a: string, b: string, seed: number) {
    const agents = [engine.createAgent(a, seed * 10 + 1), engine.createAgent(b, seed * 10 + 2)];
    const game = engine.newGame({ seed });
    const decisions: number[] = [];
    while (!game.over) {
      const agent = agents[game.turn]!;
      agent.beginTurn(game.view());
      const col = agent.firstPush(game.next);
      decisions.push(col);
      let outcome = game.push(col);
      while (!outcome.result && !outcome.turnEnded) {
        const again = agent.pushAgain(game.next);
        decisions.push(Number(again));
        if (!again) {
          game.endTurn();
          break;
        }
        outcome = game.push(col);
      }
    }
    agents.forEach((agent) => agent.free());
    return { winner: game.result!.winner, decisions };
  }

  it("plays complete, reproducible games", () => {
    for (const [a, b] of [["easy", "normal"], ["hard", "normal"], ["strong:1,3", "easy"]] as const) {
      const first = play(a, b, 3);
      expect(first.decisions.length).toBeGreaterThan(10);
      expect(play(a, b, 3)).toEqual(first);
    }
  });

  it("reports the Impossible AI's estimated chance of winning", () => {
    const impossible = engine.createAgent("impossible", 1);
    const hard = engine.createAgent("hard", 1);
    expect(impossible.winEstimate()).toBe(null);
    for (const agent of [impossible, hard]) {
      agent.beginTurn(initialBoard());
      agent.firstPush(Ball.Common);
    }
    const p = impossible.winEstimate();
    expect(p).not.toBe(null);
    expect(p!).toBeGreaterThan(0);
    expect(p!).toBeLessThan(1);
    expect(hard.winEstimate()).toBe(null);
    impossible.free();
    hard.free();
  });

  it("plays the Impossible AI reproducibly", { timeout: 120_000 }, () => {
    const first = play("impossible", "easy", 4);
    expect(first.decisions.length).toBeGreaterThan(5);
    expect(play("impossible", "easy", 4)).toEqual(first);
  });

  it("rejects invalid input instead of crashing", () => {
    const board = engine.createBoard(initialBoard());
    expect(() => board.push(Side.Left, 6, Ball.Common)).toThrow();
    expect(() => board.push(Side.Left, 0, 9 as Ball)).toThrow();
    board.free();
    expect(() => board.evaluate()).toThrow();
    expect(() => engine.createAgent("strong:0,1")).toThrow();
    expect(() => engine.createAgent("genius")).toThrow();
  });
});
