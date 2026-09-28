import type { Board } from "../board.ts";
import { Ball, RULES, Side } from "../constants.ts";
import { randomBall, type Rng } from "../random.ts";
import type { Agent } from "./agent.ts";
import { LOSS, PoolSearch } from "./search.ts";

const MAX_PUSHES = RULES.maxPushesPerTurn;

/**
 * "Normal" (`maxDepth = 1`) and "Hard" (`maxDepth = 2`) AI: alpha-beta search
 * averaged over `fillout` random sequences of upcoming balls.
 *
 * Derived from the original (Beta 0.8) `StrongAI`, with its bugs fixed; see
 * docs/ai.md.
 */
export class StrongAI implements Agent {
  readonly name: string;
  readonly maxDepth: number;
  readonly fillout: number;

  private readonly rng: Rng;
  private readonly searcher = new PoolSearch();
  private root!: Board;
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

  /** For each line, the average over samples of its searched value; pushes the best line. */
  firstPush(next: Ball): number {
    const colValue = new Array<number>(this.root.lCol).fill(0);
    for (let i = 0; i < this.fillout; i++) {
      this.sample(next, this.maxDepth * MAX_PUSHES);
      for (let l = 0; l < this.root.lCol; l++) {
        colValue[l]! += this.searcher.searchCol(this.root, this.maxDepth, -Infinity, Infinity, Side.Left, 0, l);
      }
    }
    const bestCol = argmax(colValue);
    this.root.push(Side.Left, bestCol, next);
    this.moved = 1;
    this.currentCol = bestCol;
    return bestCol;
  }

  /**
   * Compares the plans "stop now" and "push m more times" (m = 1 … pushes
   * left), each followed by an opponent search of the same depth
   * `max(1, maxDepth − 1)`. Pushes again if some m ≥ 1 is strictly better
   * than stopping. (At least one ply, so that Normal also sees the
   * opponent's reply when deciding whether to stop.)
   */
  pushAgain(next: Ball): boolean {
    const maxmove = MAX_PUSHES - this.moved;
    if (maxmove === 0) return false;
    const depth = Math.max(1, this.maxDepth - 1);
    const value = new Array<number>(maxmove + 1).fill(0);
    for (let i = 0; i < this.fillout; i++) {
      this.sample(next, depth * MAX_PUSHES + maxmove);
      value[0]! -= this.searcher.search(this.root, depth, -Infinity, Infinity, Side.Right, 0);
      const node = this.root.clone();
      for (let m = 1; m <= maxmove; m++) {
        const last = node.push(Side.Left, this.currentCol, this.searcher.pool[m - 1]!);
        // Pushing the Key off loses; plans with more pushes lose too in this sample.
        // After a Flip the turn is over; longer plans are the same as this one.
        const v = last === Ball.Key ? LOSS : -this.searcher.search(node, depth, -Infinity, Infinity, Side.Right, m);
        if (last === Ball.Key || last === Ball.Flip) {
          for (let j = m; j <= maxmove; j++) value[j]! += v;
          break;
        }
        value[m]! += v;
      }
    }
    const again = argmax(value) !== 0;
    if (again) {
      this.root.push(Side.Left, this.currentCol, next);
      this.moved++;
    }
    return again;
  }

  /** Starts a new sample: the real next ball followed by `size − 1` random ones. */
  private sample(next: Ball, size: number): void {
    const pool = [next];
    for (let i = 1; i < size; i++) pool.push(randomBall(this.rng));
    this.searcher.pool = pool;
  }
}

/** Index of the largest value (the first one on ties). */
function argmax(values: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i]! > values[best]!) best = i;
  return best;
}
