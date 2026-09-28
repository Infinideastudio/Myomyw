import type { Board } from "../board.ts";
import type { Ball } from "../constants.ts";

/**
 * A computer player.
 *
 * Agents always think of themselves as the **Left** player: the host passes
 * `board.viewFor(side)` (the board flipped when the agent plays Right), and the
 * column numbers they return are valid for the real board unchanged.
 *
 * Protocol for one turn (the host must follow it exactly, because agents keep
 * a private copy of the board and update it as they go):
 *
 * 1. `beginTurn(view)` with a fresh copy of the position.
 * 2. `firstPush(next)` → the line to push; the host pushes it, inserting `next`.
 * 3. While the turn continues (no Flip fell off, fewer than 5 pushes, game not
 *    over): `pushAgain(next)` with the *new* upcoming ball. `true` means
 *    "push the same line again" and the host pushes, inserting `next`;
 *    `false` means "end the turn".
 */
export interface Agent {
  readonly name: string;
  beginTurn(view: Board): void;
  firstPush(next: Ball): number;
  pushAgain(next: Ball): boolean;
}
