import { Ball, RULES, Side } from "./constants.ts";
import { copyGrid, createGrid, shiftLine, transposeGrid, type Grid } from "./grid.ts";

/**
 * Pure board state: a diamond-shaped `lCol × rCol` grid of balls.
 *
 * The balls live in a fixed `maxCols × maxCols` backing matrix; only the
 * `[0, lCol) × [0, rCol)` corner is on the board. Cells outside it keep
 * whatever they last held and are reset to common balls when the board grows
 * back over them, so they never affect the game. (This mirrors the original
 * implementation exactly, which the tests check cell for cell.)
 */
export class Board {
  readonly cells: Grid<Ball>;
  /** Number of Left ejectors = length of every Right line. */
  lCol: number;
  /** Number of Right ejectors = length of every Left line. */
  rCol: number;

  constructor(cells: Grid<Ball>, lCol: number, rCol: number) {
    this.cells = copyGrid(cells);
    this.lCol = lCol;
    this.rCol = rCol;
  }

  /** The starting position: 6 × 6 common balls. */
  static initial(): Board {
    return new Board(createGrid(() => Ball.Common), RULES.initialCols, RULES.initialCols);
  }

  clone(): Board {
    return new Board(this.cells, this.lCol, this.rCol);
  }

  /** Number of ejectors (= lines) owned by `side`. */
  ejectors(side: Side): number {
    return side === Side.Left ? this.lCol : this.rCol;
  }

  /** Length of each line pushed by `side`. */
  lineLength(side: Side): number {
    return side === Side.Left ? this.rCol : this.lCol;
  }

  /**
   * One push: `side` inserts `ball` into line `col`; the ball at the far end
   * falls off and its effect is applied. Returns the ball that fell off.
   *
   * Winning/losing (a Key falling off) and turn handling are not board
   * concerns; see {@link Game}.
   */
  push(side: Side, col: number, ball: Ball): Ball {
    const ejected = this.shift(side, col, ball);
    this.applyEffect(side, ejected);
    return ejected;
  }

  /** First half of {@link push}: only moves the balls. */
  shift(side: Side, col: number, ball: Ball): Ball {
    return shiftLine(this.cells, this.lCol, this.rCol, side, col, ball);
  }

  /** Second half of {@link push}: applies the effect of a ball that `side` pushed off. */
  applyEffect(side: Side, ejected: Ball): void {
    switch (ejected) {
      case Ball.AddCol:
        if (side === Side.Left) this.resize(this.lCol, this.rCol + 1);
        else this.resize(this.lCol + 1, this.rCol);
        break;
      case Ball.DelCol:
        if (side === Side.Left) this.resize(this.lCol, this.rCol - 1);
        else this.resize(this.lCol - 1, this.rCol);
        break;
      case Ball.Flip:
        this.flip();
        break;
    }
  }

  /**
   * Changes the board size. Out-of-range sizes are ignored. Cells that come
   * back onto the board are filled with common balls.
   */
  resize(lCol: number, rCol: number): void {
    if (lCol > RULES.maxCols || lCol < RULES.minCols || rCol > RULES.maxCols || rCol < RULES.minCols) return;
    for (let l = this.lCol; l < lCol; l++) {
      for (let r = 0; r < rCol; r++) this.cells[l]![r] = Ball.Common;
    }
    for (let l = 0; l < lCol; l++) {
      for (let r = this.rCol; r < rCol; r++) this.cells[l]![r] = Ball.Common;
    }
    this.lCol = lCol;
    this.rCol = rCol;
  }

  /** Mirrors the board: transposes the matrix and swaps the ejector counts. */
  flip(): void {
    transposeGrid(this.cells);
    const temp = this.rCol;
    this.rCol = this.lCol;
    this.lCol = temp;
  }

  /** The board as seen by `side` if it were playing Left (what AIs receive). */
  viewFor(side: Side): Board {
    const view = this.clone();
    if (side === Side.Right) view.flip();
    return view;
  }
}
