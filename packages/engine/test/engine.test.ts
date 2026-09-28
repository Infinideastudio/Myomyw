/**
 * Checks the WebAssembly build of the Rust engine against the TypeScript
 * engine: same rules, and the same AI decisions for the same seeds.
 * Requires `npm run build:wasm` (run automatically by `npm test`).
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Ball, Board, Game, Side, agentFromSpec, randomBall, seededRng } from "@myomyw/core";
import { Engine } from "../js/index.ts";

let engine: Engine;

beforeAll(async () => {
  engine = await Engine.load(readFileSync(new URL("../dist/myomyw_engine.wasm", import.meta.url)));
});

function visible(board: Board): Ball[][] {
  return board.cells.slice(0, board.lCol).map((row) => row.slice(0, board.rCol));
}

describe("WebAssembly engine", () => {
  it("applies pushes exactly like the TypeScript Board", () => {
    const rng = seededRng(99);
    for (let game = 0; game < 50; game++) {
      const board = Board.initial();
      const wasm = engine.createBoard(board);
      for (let step = 0; step < 300; step++) {
        const side = (rng() < 0.5 ? Side.Left : Side.Right) as Side;
        const col = Math.floor(rng() * board.ejectors(side));
        const ball = randomBall(rng);
        expect(wasm.push(side, col, ball)).toBe(board.push(side, col, ball));
      }
      const copy = wasm.read();
      expect([copy.lCol, copy.rCol]).toEqual([board.lCol, board.rCol]);
      expect(visible(copy)).toEqual(visible(board));
      wasm.free();
    }
  });

  it("rejects invalid input instead of crashing", () => {
    const wasm = engine.createBoard(Board.initial());
    expect(() => wasm.push(Side.Left, 6, Ball.Common)).toThrow();
    expect(() => wasm.push(Side.Left, 0, 9 as Ball)).toThrow();
    wasm.free();
    expect(() => wasm.evaluate()).toThrow();
    expect(() => engine.createAgent("strong:0,1", 1)).toThrow();
  });

  const matchups: [string, string, number][] = [
    ["easy", "normal", 20],
    ["normal", "hard", 10],
    ["hard", "hard", 5],
  ];
  for (const [a, b, games] of matchups) {
    it(`plays ${a} vs ${b} move for move like the TypeScript agents`, { timeout: 120_000 }, () => {
      for (let seed = 1; seed <= games; seed++) {
        const specs = [a, b];
        const ts = specs.map((spec, i) => agentFromSpec(spec, seededRng(seed * 10 + i)));
        const wasm = specs.map((spec, i) => engine.createAgent(spec, seed * 10 + i));
        const game = new Game({ rng: seededRng(seed) });
        while (!game.over) {
          const [mine, theirs] = [ts[game.turn]!, wasm[game.turn]!];
          const view = game.board.viewFor(game.turn);
          mine.beginTurn(view.clone());
          theirs.beginTurn(view);
          const col = mine.firstPush(game.next);
          expect(theirs.firstPush(game.next)).toBe(col);
          let outcome = game.push(col);
          while (!outcome.result && !outcome.turnEnded) {
            const again = mine.pushAgain(game.next);
            expect(theirs.pushAgain(game.next)).toBe(again);
            if (!again) {
              game.endTurn();
              break;
            }
            outcome = game.push(col);
          }
        }
        wasm.forEach((agent) => agent.free());
      }
    });
  }
});
