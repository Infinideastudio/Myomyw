/** Tests of the AI players. */
import { describe, expect, it } from "vitest";
import {
  Ball,
  Board,
  LOSS,
  PoolSearch,
  RULES,
  Side,
  StrongAI,
  WeakAI,
  evaluate,
  opponent,
  playMatch,
  randomBall,
  seededRng,
  type Rng,
} from "../src/index.ts";

function randomBoard(rng: Rng): Board {
  const board = Board.initial();
  for (let l = 0; l < RULES.maxCols; l++) for (let r = 0; r < RULES.maxCols; r++) board.cells[l]![r] = rng() < 0.5 ? Ball.Common : randomBall(rng);
  board.lCol = 3 + Math.floor(rng() * 8);
  board.rCol = 3 + Math.floor(rng() * 8);
  return board;
}

/** Plain negamax without pruning, with the same move semantics as PoolSearch. */
function negamax(pool: Ball[], node: Board, depth: number, side: Side, ptr: number): number {
  if (depth === 0) return side === Side.Left ? evaluate(node) : -evaluate(node);
  let best = -Infinity;
  for (let col = 0; col < node.ejectors(side); col++) {
    const child = node.clone();
    let p = ptr;
    for (let i = 0; i < RULES.maxPushesPerTurn; i++) {
      const last = child.push(side, col, pool[p++]!);
      best = Math.max(best, last === Ball.Key ? LOSS : -negamax(pool, child, depth - 1, opponent(side), p));
      if (last === Ball.Key || last === Ball.Flip) break;
    }
  }
  return best;
}

describe("PoolSearch", () => {
  it("returns exactly the unpruned negamax value (alpha-beta is sound)", () => {
    const rng = seededRng(2024);
    const search = new PoolSearch();
    for (let n = 0; n < 60; n++) {
      const board = randomBoard(rng);
      search.pool = Array.from({ length: 10 }, () => randomBall(rng));
      const side = (n % 2) as Side;
      const depth = n % 3 === 0 ? 2 : 1;
      expect(search.search(board, depth, -Infinity, Infinity, side, 0)).toBe(negamax(search.pool, board, depth, side, 0));
    }
  });

  it("lets Right consider all of its own lines", () => {
    // Right has 6 lines, Left 3. Right's lines 0–2 would push a Key off; lines 3–5 are safe.
    const board = Board.initial();
    board.resize(3, 6);
    for (let r = 0; r < 3; r++) board.cells[2]![r] = Ball.Key;
    const search = new PoolSearch();
    search.pool = Array(5).fill(Ball.Common);
    expect(search.search(board, 1, -Infinity, Infinity, Side.Right, 0)).toBeGreaterThan(LOSS);
  });

  it("evaluates only cells on the board", () => {
    const board = Board.initial();
    board.resize(4, 5);
    const clean = evaluate(board);
    for (let l = 0; l < RULES.maxCols; l++) for (let r = 0; r < RULES.maxCols; r++) if (l >= 4 || r >= 5) board.cells[l]![r] = Ball.Key;
    expect(evaluate(board)).toBe(clean);
  });
});

describe("StrongAI", () => {
  for (const depth of [1, 2]) {
    it(`(depth ${depth}) stops instead of pushing a Key off the board`, () => {
      // Every line has a Key second from the exit: one push is safe, two lose.
      const board = Board.initial();
      for (let l = 0; l < 6; l++) board.cells[l]![4] = Ball.Key;
      const ai = new StrongAI(depth, 10, seededRng(depth));
      ai.beginTurn(board);
      ai.firstPush(Ball.Common);
      expect(ai.pushAgain(Ball.Common)).toBe(false);
    });
  }

  it("never reads past its ball pool in real games", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = playMatch(new StrongAI(2, 10, seededRng(seed)), new StrongAI(1, 10, seededRng(seed + 100)), { rng: seededRng(seed + 200) });
      expect(result.winner).not.toBeNull();
    }
  });
});

describe("WeakAI", () => {
  it("scores Flip balls", () => {
    // The agent has more lines than the opponent, so a Flip would cost it lines (−1 each).
    const board = Board.initial();
    board.resize(6, 4);
    for (let r = 0; r < 4; r++) board.cells[0]![r] = Ball.Flip;
    for (let l = 1; l < 6; l++) for (let r = 0; r < 3; r++) board.cells[l]![r] = Ball.AddCol;
    const ai = new WeakAI();
    ai.beginTurn(board);
    // Scored 0 (the original's bug), line 0 would look best; scored −1 each, it is the worst.
    expect(ai.firstPush(Ball.Common)).toBe(1);
  });
});
