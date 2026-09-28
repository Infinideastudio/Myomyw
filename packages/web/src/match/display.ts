import { Ball, Board, Side, createGrid, shiftLine, transposeGrid, type Grid } from "@myomyw/core";

/**
 * Display coordinates: `x` is the index along Left's lines (the `r` matrix
 * index), `y` along Right's lines (the `l` index). Ejectors sit at x = -1
 * (Left) and y = -1 (Right); the timer sits at (-1, -1).
 */
export interface Cell {
  x: number;
  y: number;
}

export interface BallSprite extends Cell {
  id: number;
  ball: Ball;
}

/** A ball leaving the board: it moves from `from` to `to` while fading out. */
export interface Ghost {
  id: number;
  ball: Ball;
  from: Cell;
  to: Cell;
}

export interface ShiftResult {
  ejected: Ball;
  ghost: Ghost;
  /** The inserted ball and the ejector cell it slides in from. */
  entering: { id: number; from: Cell };
}

/**
 * The board as currently shown on screen, plus a stable sprite id for each
 * cell so that balls can be animated as they move. Every change goes through
 * the same primitives as the rules engine (`Board.shift` / `applyEffect`),
 * so the display cannot drift from the real game state.
 */
export class DisplayBoard {
  readonly board: Board;
  private readonly ids: Grid<number>;
  private nextId = 1;

  constructor(board: Board) {
    this.board = board.clone();
    this.ids = createGrid(() => this.nextId++);
  }

  get lCol(): number {
    return this.board.lCol;
  }

  get rCol(): number {
    return this.board.rCol;
  }

  sprites(): BallSprite[] {
    const sprites: BallSprite[] = [];
    for (let l = 0; l < this.board.lCol; l++) {
      for (let r = 0; r < this.board.rCol; r++) {
        sprites.push({ id: this.ids[l]![r]!, ball: this.board.cells[l]![r]!, x: r, y: l });
      }
    }
    return sprites;
  }

  /** Moves the balls of one push (without applying the effect of the ejected ball). */
  shift(side: Side, col: number, ball: Ball): ShiftResult {
    const { lCol, rCol } = this.board;
    const id = this.nextId++;
    const ejectedId = shiftLine(this.ids, lCol, rCol, side, col, id);
    const ejected = this.board.shift(side, col, ball);
    const left = side === Side.Left;
    return {
      ejected,
      ghost: {
        id: ejectedId,
        ball: ejected,
        from: left ? { x: rCol - 1, y: col } : { x: col, y: lCol - 1 },
        to: left ? { x: rCol, y: col } : { x: col, y: lCol },
      },
      entering: { id, from: left ? { x: -1, y: col } : { x: col, y: -1 } },
    };
  }

  /** Applies the effect of an ejected ball. Returns ghosts for balls removed by a shrink. */
  applyEffect(side: Side, ejected: Ball): Ghost[] {
    const before = { lCol: this.board.lCol, rCol: this.board.rCol };
    this.board.applyEffect(side, ejected);
    if (ejected === Ball.Flip) {
      transposeGrid(this.ids);
      return [];
    }
    const { lCol, rCol } = this.board;
    const removed: Ghost[] = [];
    const inside = (l: number, r: number, size: { lCol: number; rCol: number }) => l < size.lCol && r < size.rCol;
    for (let l = 0; l < Math.max(lCol, before.lCol); l++) {
      for (let r = 0; r < Math.max(rCol, before.rCol); r++) {
        const wasIn = inside(l, r, before);
        const isIn = inside(l, r, this.board);
        if (isIn && !wasIn) this.ids[l]![r] = this.nextId++;
        if (wasIn && !isIn) {
          const cell = { x: r, y: l };
          removed.push({ id: this.ids[l]![r]!, ball: this.board.cells[l]![r]!, from: cell, to: cell });
        }
      }
    }
    return removed;
  }

  /** Replaces a ball in place (used by the tutorial). */
  setBall(l: number, r: number, ball: Ball): void {
    this.board.cells[l]![r] = ball;
    this.ids[l]![r] = this.nextId++;
  }
}
