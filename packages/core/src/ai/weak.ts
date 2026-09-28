import type { Board } from "../board.ts";
import { Ball, RULES, Side } from "../constants.ts";
import type { Agent } from "./agent.ts";

/**
 * "Easy" AI: a one-shot heuristic with no search.
 *
 * Each of its lines gets a weighted score (balls nearer the exit weigh more):
 *   common +1, key −3 (−10 if it is the next ball to fall off), add-column −1,
 *   delete-column +2, flip 0.
 * It picks the best line and pushes it `round(bestScore)` times, clamped to
 * [1, 5], stopping early if a flip ball falls off.
 *
 * Faithful port of the original `WeakAI`. The original meant to score flip
 * balls (+1 if the opponent has more lines, else −1) but misspelled the case
 * label, so flip balls have always scored 0. That behaviour is preserved.
 */
export class WeakAI implements Agent {
  readonly name = "WeakAI";

  private board!: Board;
  private bestCol = 0;
  private remaining = 0;

  beginTurn(view: Board): void {
    this.board = view;
    let maxWeighting = -100;
    this.bestCol = 0;
    for (let l = 0; l < view.lCol; l++) {
      let weighting = 0;
      for (let r = 0; r < view.rCol; r++) {
        let change = 0;
        switch (view.cells[l]![r]) {
          case Ball.Common:
            change = 1;
            break;
          case Ball.Key:
            change = r === view.rCol - 1 ? -10 : -3;
            break;
          case Ball.AddCol:
            change = -1;
            break;
          case Ball.DelCol:
            change = 2;
            break;
          // Ball.Flip: 0 (see class comment).
        }
        weighting += change * ((r + 1) / view.rCol);
      }
      if (weighting > maxWeighting) {
        maxWeighting = weighting;
        this.bestCol = l;
      }
    }
    const times = Math.round(maxWeighting);
    this.remaining = Math.min(Math.max(times, 1), RULES.maxPushesPerTurn);
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

  private pushOnce(next: Ball): void {
    this.remaining--;
    if (this.board.push(Side.Left, this.bestCol, next) === Ball.Flip) this.remaining = 0;
  }
}
