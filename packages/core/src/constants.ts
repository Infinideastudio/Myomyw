/**
 * The two players. Numeric values matter: several algorithms use `side ^ 1`
 * to get the opponent and `side * 2 - 1` as a sign.
 *
 * - `Left`  (green) owns the ejectors on the upper-left edge and moves first.
 * - `Right` (blue)  owns the ejectors on the upper-right edge.
 */
export const Side = { Left: 0, Right: 1 } as const;
export type Side = (typeof Side)[keyof typeof Side];

export function opponent(side: Side): Side {
  return (side ^ 1) as Side;
}

/** Ball kinds. The numeric ids are also used on the wire. */
export const Ball = {
  /** Black. No effect when pushed off. */
  Common: 0,
  /** Red. Whoever pushes it off the board loses. */
  Key: 1,
  /** Green "+". Gives the opponent one more ejector (their lines get one longer). */
  AddCol: 2,
  /** Yellow "−". Takes one ejector away from the opponent. */
  DelCol: 3,
  /** Blue arrow. Mirrors the board and ends the pusher's turn immediately. */
  Flip: 4,
} as const;
export type Ball = (typeof Ball)[keyof typeof Ball];

export const BALL_KINDS: readonly Ball[] = [Ball.Common, Ball.Key, Ball.AddCol, Ball.DelCol, Ball.Flip];

/** Game rule constants. See docs/rules.md. */
export const RULES = {
  /** Size of the backing matrix, and the maximum number of ejectors per side. */
  maxCols: 10,
  /** Minimum number of ejectors per side. */
  minCols: 3,
  /** Ejectors per side at the start of a game. */
  initialCols: 6,
  /** Maximum number of pushes in a single turn. */
  maxPushesPerTurn: 5,
  /** Time allowed from the start of a turn until its first push (when the timer is enabled). */
  turnTimeLimitMs: 20_000,
} as const;
