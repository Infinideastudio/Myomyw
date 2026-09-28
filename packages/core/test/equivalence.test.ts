/**
 * Proves that the rules engine is an exact port of the original Beta 0.8
 * JavaScript (see test/legacy/).
 */
import { describe, expect, it } from "vitest";
import { Board, Side, randomBall, seededRng } from "../src/index.ts";
import { loadLegacy } from "./legacy.ts";

describe("Board matches the original GameNode", () => {
  it("produces identical backing matrices over long random push sequences", () => {
    const legacy = loadLegacy();
    const rng = seededRng(12345);
    for (let game = 0; game < 200; game++) {
      const board = Board.initial();
      const node = new legacy.GameNode(board.cells, board.lCol, board.rCol);
      for (let step = 0; step < 300; step++) {
        const side = (rng() < 0.5 ? Side.Left : Side.Right) as Side;
        const col = Math.floor(rng() * board.ejectors(side));
        const ball = randomBall(rng);
        expect(board.push(side, col, ball)).toBe(node.moveOnce(side, col, ball));
        expect(board.lCol).toBe(node.lCol);
        expect(board.rCol).toBe(node.rCol);
        expect(board.cells).toEqual(node.chessmen);
      }
    }
  });
});
