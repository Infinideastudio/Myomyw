import { Ball, Side, type BoardSnapshot } from "@myomyw/engine";
import { createGrid, shiftLine, transposeGrid, type Grid } from "./grid.ts";

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

interface Size {
  lCol: number;
  rCol: number;
}

const inside = (l: number, r: number, size: Size) => l < size.lCol && r < size.rCol;

/**
 * The board as currently shown on screen, plus a stable sprite id for each
 * cell so that balls can be animated as they move.
 *
 * A push is shown in two steps: {@link shift} moves the balls (the push
 * animation), then {@link applyEffect} shows the effect of the ejected ball
 * and adopts the engine's resulting board, so the display can never drift
 * from the real game state.
 */
export class DisplayBoard {
  private readonly balls: Grid<Ball>;
  private readonly ids: Grid<number>;
  private size: Size;
  private nextId = 1;

  constructor(board: BoardSnapshot) {
    this.balls = createGrid((l, r) => board.cells[l]![r]!);
    this.ids = createGrid(() => this.nextId++);
    this.size = { lCol: board.lCol, rCol: board.rCol };
  }

  get lCol(): number {
    return this.size.lCol;
  }

  get rCol(): number {
    return this.size.rCol;
  }

  sprites(): BallSprite[] {
    const sprites: BallSprite[] = [];
    for (let l = 0; l < this.size.lCol; l++) {
      for (let r = 0; r < this.size.rCol; r++) sprites.push({ id: this.ids[l]![r]!, ball: this.balls[l]![r]!, x: r, y: l });
    }
    return sprites;
  }

  /** Moves the balls of one push (without the effect of the ejected ball). */
  shift(side: Side, col: number, ball: Ball): ShiftResult {
    const { lCol, rCol } = this.size;
    const id = this.nextId++;
    const ejectedId = shiftLine(this.ids, lCol, rCol, side, col, id);
    const ejected = shiftLine(this.balls, lCol, rCol, side, col, ball);
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

  /**
   * Shows the effect of `ejected` and adopts `board`, the engine's position
   * after the push. Returns ghosts for balls removed by a shrink.
   */
  applyEffect(ejected: Ball, board: BoardSnapshot): Ghost[] {
    let before = this.size;
    if (ejected === Ball.Flip) {
      transposeGrid(this.ids);
      transposeGrid(this.balls);
      before = { lCol: before.rCol, rCol: before.lCol };
    }
    const removed: Ghost[] = [];
    for (let l = 0; l < Math.max(board.lCol, before.lCol); l++) {
      for (let r = 0; r < Math.max(board.rCol, before.rCol); r++) {
        const wasIn = inside(l, r, before);
        const isIn = inside(l, r, board);
        if (isIn && !wasIn) this.ids[l]![r] = this.nextId++;
        if (wasIn && !isIn) removed.push({ id: this.ids[l]![r]!, ball: this.balls[l]![r]!, from: { x: r, y: l }, to: { x: r, y: l } });
      }
    }
    for (let l = 0; l < board.cells.length; l++) for (let r = 0; r < board.cells[l]!.length; r++) this.balls[l]![r] = board.cells[l]![r]!;
    this.size = { lCol: board.lCol, rCol: board.rCol };
    return removed;
  }

  /** Replaces a ball in place (used by the tutorial). */
  setBall(l: number, r: number, ball: Ball): void {
    this.balls[l]![r] = ball;
    this.ids[l]![r] = this.nextId++;
  }
}
