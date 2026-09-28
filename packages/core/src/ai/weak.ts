import type { Board } from "../board.ts";
import { Ball, RULES, Side } from "../constants.ts";
import type { Agent } from "./agent.ts";

/**
 * "Easy" AI: a one-shot heuristic with no search.
 *
 * Each of its lines gets a weighted score (balls nearer the exit weigh more):
 *   common +1, key −3 (−10 if it is the next ball to fall off), add-line −1,
 *   remove-line +2, flip +1 if the opponent has more lines (a flip would give
 *   them to us), else −1.
 * It picks the best line and pushes it `round(bestScore)` times, clamped to
 * [1, 5], stopping early if a flip ball falls off.
 *
 * Same as the original (Beta 0.8) `WeakAI`, except that flip balls are scored
 * as it intended; a misspelled case label made them always score 0.
 */
export class WeakAI implements Agent {
  readonly name = "WeakAI";

  private board!: Board;
  private bestCol = 0;
  private remaining = 0;

  beginTurn(view: Board): void {
    this.board = view;
    let maxWeighting = -Infinity;
    this.bestCol = 0;
    for (let l = 0; l < view.lCol; l++) {
      let weighting = 0;
      for (let r = 0; r < view.rCol; r++) {
        weighting += WeakAI.ballValue(view, view.cells[l]![r]!, r) * ((r + 1) / view.rCol);
      }
      if (weighting > maxWeighting) {
        maxWeighting = weighting;
        this.bestCol = l;
      }
    }
    this.remaining = Math.min(Math.max(Math.round(maxWeighting), 1), RULES.maxPushesPerTurn);
  }

  firstPush(next: Ball): number {
    this.pushOnce(next);
    return this.bestCol;
  }

  pushAgain(next: Ball): boolean {
    if (this.remaining <= 0) return false;
    this.pushOnce(next);
    return true;
  }

  private static ballValue(view: Board, ball: Ball, r: number): number {
    switch (ball) {
      case Ball.Common:
        return 1;
      case Ball.Key:
        return r === view.rCol - 1 ? -10 : -3;
      case Ball.AddCol:
        return -1;
      case Ball.DelCol:
        return 2;
      case Ball.Flip:
        return view.rCol > view.lCol ? 1 : -1;
    }
  }

  private pushOnce(next: Ball): void {
    this.remaining--;
    if (this.board.push(Side.Left, this.bestCol, next) === Ball.Flip) this.remaining = 0;
  }
}
