import { Side } from "@myomyw/engine";
import { motion, type Transition } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { format, useMessages } from "../i18n/index.tsx";
import type { Cell } from "../match/display.ts";
import { canPress, type MatchController, type MatchSnapshot } from "../match/types.ts";
import { BallDefs, BallShape } from "./BallGlyph.tsx";

/** The SVG is drawn in a 1000 × 1000 box. */
const SIZE = 1000;
/** Shapes are designed for a cell whose half-diagonal is 50 units, then scaled. */
const BASE = 50;

/**
 * Maps display cells to SVG coordinates. The logical grid is axis-aligned
 * (x = along Left's lines, y = along Right's lines) and drawn rotated by 45°,
 * so the timer cell (-1, -1) is the top corner of the diamond.
 */
class Layout {
  /** Half-diagonal of a cell. */
  readonly h: number;
  private readonly lCol: number;

  constructor(lCol: number, rCol: number) {
    this.lCol = lCol;
    this.h = SIZE / (lCol + rCol + 2);
  }

  /** Center of a cell. */
  center({ x, y }: Cell): { x: number; y: number } {
    return { x: (x - y + this.lCol + 1) * this.h, y: (x + y + 3) * this.h };
  }

  /** A lattice point (cell corner) in grid units. */
  point(gx: number, gy: number): string {
    return `${((gx - gy + this.lCol + 1) * this.h).toFixed(2)} ${((gx + gy + 2) * this.h).toFixed(2)}`;
  }

  /** Closed polygon path through lattice points. */
  path(points: [number, number][]): string {
    return `M${points.map(([gx, gy]) => this.point(gx, gy)).join("L")}Z`;
  }

  /** Animation target placing a BASE-sized shape on a cell. */
  place(cell: Cell): { x: number; y: number; scale: number } {
    return { ...this.center(cell), scale: this.h / BASE };
  }
}

const DIAMOND = `M0 ${-BASE}L${BASE} 0L0 ${BASE}L${-BASE} 0Z`;
const INSET_DIAMOND = `M0 ${-BASE + 5}L${BASE - 5} 0L0 ${BASE - 5}L${-BASE + 5} 0Z`;
const SIDE_CLASS = ["left", "right"] as const;

interface Props {
  match: MatchController;
  snapshot: MatchSnapshot;
}

export function BoardView({ match, snapshot: s }: Props) {
  const t = useMessages();
  const layout = new Layout(s.lCol, s.rCol);
  const transition: Transition = { duration: s.animMs / 1000, ease: "easeOut" };
  const [hover, setHover] = useState<{ side: Side; col: number } | null>(null);
  const pressing = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const interactive = canPress(s);
  const turn = s.turn;

  // Release wherever the pointer goes up, even outside the board.
  useEffect(() => {
    const up = () => {
      if (!pressing.current) return;
      pressing.current = false;
      match.release();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
    };
  }, [match]);

  const press = (side: Side, col: number) => {
    if (!interactive || side !== turn) return;
    pressing.current = true;
    setHover(null);
    match.press(col);
  };

  /** Hover highlighting; works for touch too (press outside, then slide onto an ejector). */
  const onPointerMove = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>("[data-side]");
    const side = el ? (Number(el.dataset.side) as Side) : null;
    setHover(el && side === turn && interactive ? { side: side!, col: Number(el.dataset.col) } : null);
  };

  const onKey = (side: Side, col: number) => (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (e.type === "keydown" && !e.repeat) press(side, col);
    if (e.type === "keyup" && pressing.current) {
      pressing.current = false;
      match.release();
    }
  };

  const lineOf = (side: Side, col: number): string =>
    side === Side.Left
      ? layout.path([[-1, col], [s.rCol, col], [s.rCol, col + 1], [-1, col + 1]])
      : layout.path([[col, -1], [col + 1, -1], [col + 1, s.lCol], [col, s.lCol]]);

  const highlighted = hover && interactive ? hover : turn !== null && s.activeLine !== null ? { side: turn, col: s.activeLine } : null;

  const cells = [];
  for (let y = 0; y < s.lCol; y++) {
    for (let x = 0; x < s.rCol; x++) {
      cells.push(
        <motion.path key={`c${x}_${y}`} d={DIAMOND} className={(x + y) % 2 ? "cell cell-b" : "cell cell-a"} initial={mounted.current ? { ...layout.place({ x, y }), scale: 0 } : false} animate={layout.place({ x, y })} transition={transition} />,
      );
    }
  }

  const ejectors = [];
  for (const side of [Side.Left, Side.Right]) {
    const count = side === Side.Left ? s.lCol : s.rCol;
    for (let col = 0; col < count; col++) {
      const cell = side === Side.Left ? { x: -1, y: col } : { x: col, y: -1 };
      const active = side === turn && interactive;
      ejectors.push(
        <motion.g
          key={`e${side}_${col}`}
          className={`ejector ejector-${SIDE_CLASS[side]}${side === turn ? " is-turn" : ""}${active ? " is-active" : ""}`}
          data-side={side}
          data-col={col}
          role="button"
          tabIndex={active ? 0 : -1}
          aria-disabled={!active}
          aria-label={format(t.game.ejector, { side: side === Side.Left ? t.names.green : t.names.blue, n: col + 1 })}
          onPointerDown={(e) => {
            e.preventDefault();
            press(side, col);
          }}
          onKeyDown={onKey(side, col)}
          onKeyUp={onKey(side, col)}
          initial={mounted.current ? { ...layout.place(cell), scale: 0 } : false}
          animate={layout.place(cell)}
          transition={transition}
        >
          <path d={INSET_DIAMOND} />
          {/* Chevron pointing in the push direction: ↘ for Left, ↙ for Right. */}
          <path className="ejector-arrow" d={side === Side.Left ? "M-4 -14L10 0L-4 14" : "M4 -14L-10 0L4 14"} transform={side === Side.Left ? "rotate(45)" : "rotate(-45)"} />
        </motion.g>,
      );
    }
  }

  const timerCenter = layout.center({ x: -1, y: -1 });
  const h = layout.h;
  const boardPath = layout.path([[0, 0], [s.rCol, 0], [s.rCol, s.lCol], [0, s.lCol]]);

  return (
    <svg
      className={`board${interactive ? " is-interactive" : ""}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <BallDefs />
      <defs>
        <clipPath id="board-clip">
          <motion.path initial={false} animate={{ d: boardPath }} transition={transition} />
        </clipPath>
        <clipPath id="timer-clip">
          <path d={layout.path([[-1, -1], [0, -1], [0, 0], [-1, 0]])} />
        </clipPath>
      </defs>

      <g>{cells}</g>

      {highlighted && <path className={`line-highlight line-${SIDE_CLASS[highlighted.side]}`} d={lineOf(highlighted.side, highlighted.col)} />}

      <g className="timer">
        <path d={layout.path([[-1, -1], [0, -1], [0, 0], [-1, 0]])} className="timer-cell" />
        {s.timer && turn !== null && (
          <g clipPath="url(#timer-clip)">
            <TimerFill key={s.timer.endsAt} timer={s.timer} x={timerCenter.x - h} top={timerCenter.y - h} size={2 * h} side={turn} />
          </g>
        )}
      </g>

      <g>{ejectors}</g>

      <g clipPath="url(#board-clip)" pointerEvents="none">
        {s.balls.map((b) => {
          const target = layout.place(b);
          const from = s.entering?.id === b.id ? { ...layout.place(s.entering.from), opacity: 1 } : { ...target, scale: 0, opacity: 0 };
          return (
            <motion.g key={b.id} initial={mounted.current ? from : false} animate={{ ...target, opacity: 1 }} transition={transition}>
              <BallShape ball={b.ball} />
            </motion.g>
          );
        })}
        {s.ghosts.map((g) => {
          const removed = g.from.x === g.to.x && g.from.y === g.to.y;
          return (
            <motion.g
              key={g.id}
              initial={{ ...layout.place(g.from), opacity: 1 }}
              animate={{ ...layout.place(g.to), opacity: 0, scale: removed ? 0 : h / BASE }}
              transition={transition}
            >
              <BallShape ball={g.ball} />
            </motion.g>
          );
        })}
      </g>
      {/* The board outline is drawn on top so pushed-out balls visibly leave through it. */}
      <motion.path className="board-outline" initial={false} animate={{ d: boardPath }} transition={transition} />
    </svg>
  );
}

function TimerFill({ timer, x, top, size, side }: { timer: { endsAt: number; totalMs: number }; x: number; top: number; size: number; side: Side }) {
  const remaining = Math.max(0, timer.endsAt - performance.now());
  const elapsedFraction = 1 - remaining / timer.totalMs;
  // The fill drains downwards out of the (clipped) timer cell.
  return (
    <g transform={`translate(${x} ${top})`}>
      <motion.path
        className={`timer-fill timer-${SIDE_CLASS[side]}`}
        d={`M0 0H${size}V${size}H0Z`}
        initial={{ y: elapsedFraction * size }}
        animate={{ y: size }}
        transition={{ duration: remaining / 1000, ease: "linear" }}
      />
    </g>
  );
}
