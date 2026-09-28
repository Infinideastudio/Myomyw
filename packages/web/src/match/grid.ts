import { RULES, Side } from "@myomyw/engine";

/**
 * Helpers on a `maxCols × maxCols` matrix `grid[l][r]`, used by the display
 * layer to move sprite ids exactly like the engine moves balls.
 */
export type Grid<T> = T[][];

export function createGrid<T>(fill: (l: number, r: number) => T): Grid<T> {
  return Array.from({ length: RULES.maxCols }, (_, l) => Array.from({ length: RULES.maxCols }, (_, r) => fill(l, r)));
}

/**
 * Inserts `item` at the ejector end of a line and shifts the line by one
 * (Left pushes along `r`, Right along `l`). Returns the item that falls off.
 */
export function shiftLine<T>(grid: Grid<T>, lCol: number, rCol: number, side: Side, col: number, item: T): T {
  let last: T;
  if (side === Side.Left) {
    const row = grid[col]!;
    last = row[rCol - 1]!;
    for (let i = rCol - 1; i > 0; i--) row[i] = row[i - 1]!;
    row[0] = item;
  } else {
    last = grid[lCol - 1]![col]!;
    for (let i = lCol - 1; i > 0; i--) grid[i]![col] = grid[i - 1]![col]!;
    grid[0]![col] = item;
  }
  return last;
}

/** Transposes the whole matrix in place. */
export function transposeGrid<T>(grid: Grid<T>): void {
  for (let l = 0; l < RULES.maxCols; l++) {
    for (let r = l + 1; r < RULES.maxCols; r++) {
      const temp = grid[l]![r]!;
      grid[l]![r] = grid[r]![l]!;
      grid[r]![l] = temp;
    }
  }
}
