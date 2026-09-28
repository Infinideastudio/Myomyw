import type { Board } from "../board.ts";
import { Ball, RULES, Side, opponent } from "../constants.ts";

/** Value, for the side that did it, of pushing the Key ball off the board. */
export const LOSS = -10000;

/**
 * Static evaluation from Left's point of view. For each line, count the
 * balls that can be pushed off before a Key falls (twice the line length if
 * it contains no Key); Left's lines count positively, Right's negatively.
 * Only cells on the board are read.
 */
export function evaluate(node: Board): number {
  let total = 0;
  for (let l = 0; l < node.lCol; l++) {
    let val = 0;
    for (let r = node.rCol - 1; r >= 0 && node.cells[l]![r] !== Ball.Key; r--) val++;
    total += val === node.rCol ? 2 * val : val;
  }
  for (let r = 0; r < node.rCol; r++) {
    let val = 0;
    for (let l = node.lCol - 1; l >= 0 && node.cells[l]![r] !== Ball.Key; l--) val++;
    total -= val === node.lCol ? 2 * val : val;
  }
  return total;
}

/**
 * Negamax search with alpha-beta pruning for one fixed sequence of upcoming
 * balls (`pool`). A move is a whole turn: choose a line, push it 1–5 times.
 * Every push, by either side, consumes the next ball of the pool.
 */
export class PoolSearch {
  /** Upcoming balls: `pool[0]` is inserted by the next push, and so on. */
  pool: Ball[] = [];

  /** Value of `node` for `side` to move, looking `depth` turns ahead. */
  search(node: Board, depth: number, alpha: number, beta: number, side: Side, poolptr: number): number {
    if (depth === 0) return side === Side.Left ? evaluate(node) : -evaluate(node);
    let best = -Infinity;
    const lines = node.ejectors(side);
    for (let col = 0; col < lines; col++) {
      best = Math.max(best, this.searchCol(node, depth, Math.max(best, alpha), beta, side, poolptr, col));
      if (best >= beta) break;
    }
    return best;
  }

  /** Best value for `side` among pushing line `col` 1..5 times and then passing the turn. */
  searchCol(node: Board, depth: number, alpha: number, beta: number, side: Side, poolptr: number, col: number): number {
    let best = -Infinity;
    const child = node.clone();
    for (let i = 0; i < RULES.maxPushesPerTurn; i++) {
      const last = child.push(side, col, this.ball(poolptr++));
      const val = last === Ball.Key ? LOSS : -this.search(child, depth - 1, -beta, -Math.max(best, alpha), opponent(side), poolptr);
      best = Math.max(best, val);
      if (best >= beta || last === Ball.Flip || last === Ball.Key) break;
    }
    return best;
  }

  private ball(index: number): Ball {
    const ball = this.pool[index];
    if (ball === undefined) throw new Error(`Search read past the ball pool (index ${index})`);
    return ball;
  }
}
