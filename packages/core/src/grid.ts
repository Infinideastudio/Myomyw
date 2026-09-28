import { RULES, Side } from "./constants.ts";

/**
 * Generic helpers for the square backing matrix `grid[l][r]`.
 *
 * They are shared by {@link Board} (which stores balls) and by the web client
 * (which mirrors the same moves on a matrix of sprite ids for animation).
 *
 * Coordinates: `l` indexes the Left player's lines (one per Left ejector,
 * `0 <= l < lCol`), `r` indexes the Right player's lines (`0 <= r < rCol`).
 * A Left push on line `l` moves `grid[l][0..rCol-1]` towards higher `r`;
 * a Right push on line `r` moves `grid[0..lCol-1][r]` towards higher `l`.
 */
export type Grid<T> = T[][];

export function createGrid<T>(fill: (l: number, r: number) => T): Grid<T> {
  const grid: Grid<T> = [];
  for (let l = 0; l < RULES.maxCols; l++) {
    grid[l] = [];
    for (let r = 0; r < RULES.maxCols; r++) grid[l]![r] = fill(l, r);
  }
  return grid;
}

export function copyGrid<T>(grid: Grid<T>): Grid<T> {
  return grid.map((row) => row.slice());
}

/**
 * Inserts `item` at the ejector end of a line and shifts the line by one.
 * Returns the item that falls off the far end.
 *
 * `col` is not bounds-checked; callers pass one of the side's lines.
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

/** Transposes the whole backing matrix in place (including inactive cells). */
export function transposeGrid<T>(grid: Grid<T>): void {
  for (let l = 0; l < RULES.maxCols; l++) {
    for (let r = l + 1; r < RULES.maxCols; r++) {
      const temp = grid[l]![r]!;
      grid[l]![r] = grid[r]![l]!;
      grid[r]![l] = temp;
    }
  }
}
