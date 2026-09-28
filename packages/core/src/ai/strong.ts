import type { Board } from "../board.ts";
import { Ball, RULES, Side } from "../constants.ts";
import { randomBall, type Rng } from "../random.ts";
import type { Agent } from "./agent.ts";

const MAX_PUSHES = RULES.maxPushesPerTurn;
/** Score of a line in which the mover pushes the Key ball off. */
const LOSS = -10000;

/**
 * "Normal" (`maxDepth = 1`) and "Hard" (`maxDepth = 2`) AI: sampled
 * alpha-beta search over random futures of upcoming balls.
 *
 * This is a faithful, line-by-line port of the original `StrongAI`. Its
 * quirks are **intentional parts of the algorithm** and must not be "fixed"
 * here (write a new agent instead); each is marked `QUIRK` below and in
 * docs/ai.md. The test suite checks move-for-move equivalence with the
 * original JavaScript.
 */
export class StrongAI implements Agent {
  readonly name: string;
  readonly maxDepth: number;
  readonly fillout: number;

  private readonly rng: Rng;
  private root!: Board;
  /** Upcoming balls for the current sample: `pool[0]` is the real next ball, the rest are random. */
  private pool: Ball[] = [];
  private moved = 0;
  private currentCol = 0;

  constructor(maxDepth: number, fillout: number, rng: Rng = Math.random) {
    this.maxDepth = maxDepth;
    this.fillout = fillout;
    this.rng = rng;
    this.name = `StrongAI(maxDepth:${maxDepth},fillout:${fillout})`;
  }

  beginTurn(view: Board): void {
    this.root = view;
  }

  /**
   * Chooses the line. For each of `fillout` random ball sequences, every line
   * is searched to `maxDepth` turns; line scores are summed with each sample
   * weighted by its (approximate) probability.
   */
  firstPush(next: Ball): number {
    const colValue: number[] = [];
    for (let l = 0; l < this.root.lCol; l++) colValue[l] = 0;
    this.pool = [next];
    for (let i = 0; i < this.fillout; i++) {
      const weight = this.fillPool(1, this.maxDepth * MAX_PUSHES - 1);
      for (let l = 0; l < this.root.lCol; l++) {
        colValue[l]! += weight * this.searchCol(this.root, this.maxDepth, -Infinity, Infinity, Side.Left, 0, l, -Infinity);
      }
    }
    let bestValue = -Infinity;
    let bestCol = 0;
    for (let l = 0; l < this.root.lCol; l++) {
      if (colValue[l]! > bestValue) {
        bestValue = colValue[l]!;
        bestCol = l;
      }
    }
    this.root.push(Side.Left, bestCol, next);
    this.moved = 1;
    this.currentCol = bestCol;
    return bestCol;
  }

  /**
   * Decides whether to push again. Compares "stop now" against "push m more
   * times" for every feasible m, over `maxDepth` random samples, and pushes
   * again if any m ≥ 1 beats stopping.
   */
  pushAgain(next: Ball): boolean {
    let maxmove = MAX_PUSHES - this.moved;
    if (maxmove === 0) return false;
    const moveValue: number[] = [];
    for (let i = 0; i <= maxmove; i++) moveValue[i] = 0;
    this.pool = [next];
    // QUIRK: the number of samples here is `maxDepth`, not `fillout`.
    for (let i = 0; i < this.maxDepth; i++) {
      const weight = this.fillPool(1, (this.maxDepth - 1) * MAX_PUSHES - 1 + maxmove);
      let poolptr = 0;
      const node = this.root.clone();
      // QUIRK: "stop now" is always evaluated with an opponent search of depth 1,
      // even when maxDepth is 1 (where "push again" is evaluated at depth 0).
      moveValue[0]! -= weight * this.search(node, 1, -Infinity, Infinity, Side.Right, poolptr);
      for (let m = 1; m <= maxmove; m++) {
        const last = node.push(Side.Left, this.currentCol, this.ball(poolptr++));
        if (last === Ball.Key) {
          // QUIRK: shrinking `maxmove` also affects later samples of this loop.
          maxmove = m - 1;
          break;
        }
        moveValue[m]! -= weight * this.search(node, this.maxDepth - 1, -Infinity, Infinity, Side.Right, poolptr);
        if (last === Ball.Flip) {
          maxmove = m;
          break;
        }
      }
    }
    let bestValue = -Infinity;
    let bestMove = 0;
    for (let i = 0; i <= maxmove; i++) {
      if (moveValue[i]! > bestValue) {
        bestValue = moveValue[i]!;
        bestMove = i;
      }
    }
    const result = bestMove !== 0;
    if (result) {
      this.root.push(Side.Left, this.currentCol, next);
      this.moved++;
    }
    return result;
  }

  /**
   * Fills `pool[start .. start+len)` with random balls and returns the sample
   * weight. QUIRK: weights use 0.6 / 0.1 although balls are drawn with
   * probabilities 7/11 / 1/11.
   */
  private fillPool(start: number, len: number): number {
    let ret = 1;
    for (let i = start; i < start + len; i++) {
      const ball = randomBall(this.rng);
      this.pool[i] = ball;
      ret *= ball === Ball.Common ? 0.6 : 0.1;
    }
    return ret;
  }

  /**
   * QUIRK: in a few positions the search reads past the filled part of the
   * pool. The original then inserted `undefined`, which behaves exactly like a
   * common ball everywhere it can end up, so a common ball is used here.
   */
  private ball(index: number): Ball {
    return this.pool[index] ?? Ball.Common;
  }

  /**
   * Static evaluation from Left's point of view. For each line, count the
   * balls that can be pushed off before a Key falls (twice the line length if
   * it contains no Key); Left's lines count positively, Right's negatively.
   */
  private evaluate(node: Board): number {
    let totalValue = 0;
    for (let l = 0; l < node.lCol; l++) {
      let val = 0;
      for (let r = node.rCol - 1; r >= 0; r--) {
        if (node.cells[l]![r] === Ball.Key) break;
        val++;
      }
      if (val === node.rCol) val *= 2;
      totalValue += val;
    }
    for (let r = 0; r < node.rCol; r++) {
      let val = 0;
      for (let l = node.lCol - 1; l >= 0; l--) {
        if (node.cells[l]![r] === Ball.Key) break;
        val++;
      }
      if (val === node.lCol) val *= 2;
      totalValue -= val;
    }
    return totalValue;
  }

  /** Negamax value of `node` for `side` to move, searching `depth` turns. */
  private search(node: Board, depth: number, alpha: number, beta: number, side: Side, poolptr: number): number {
    if (depth === 0) return -(side * 2 - 1) * this.evaluate(node);
    let bestValue = -Infinity;
    // QUIRK: iterates Left's line count even when `side` is Right, so Right
    // may skip real lines or push lines beyond the board (stale cells).
    for (let l = 0; l < node.lCol; l++) {
      // QUIRK: the original passes `maxMovements` (5) as the `bv` argument,
      // which makes searchCol cut off after one push whenever beta <= 5.
      bestValue = Math.max(bestValue, this.searchCol(node, depth, Math.max(bestValue, alpha), beta, side, poolptr, l, MAX_PUSHES));
      if (bestValue >= beta) break;
    }
    return bestValue;
  }

  /** Best value for `side` among pushing line `col` 1..5 times, then passing the turn. */
  private searchCol(node: Board, depth: number, alpha: number, beta: number, side: Side, poolptr: number, col: number, bv: number): number {
    let bestValue = -Infinity;
    const child = node.clone();
    for (let i = 0; i < MAX_PUSHES; i++) {
      const last = child.push(side, col, this.ball(poolptr++));
      let val: number;
      if (last === Ball.Key) {
        val = LOSS;
      } else {
        val = -this.search(child, depth - 1, -beta, -Math.max(bestValue, alpha), (side ^ 1) as Side, poolptr);
      }
      bestValue = Math.max(bestValue, val);
      if (Math.max(bestValue, bv) >= beta || last === Ball.Flip || last === Ball.Key) break;
    }
    return bestValue;
  }
}
