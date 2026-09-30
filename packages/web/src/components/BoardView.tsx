import { RULES, Side } from "@myomyw/engine";
import { motion, type Transition } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { format, useMessages } from "../i18n/index.tsx";
import type { Cell } from "../match/display.ts";
import { canEndTurn, canPush, type MatchController, type MatchSnapshot } from "../match/types.ts";
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
/** Half-diagonal of an ejector, drawn slightly smaller than a cell. */
const EJECTOR = BASE - 5;
const INSET_DIAMOND = `M0 ${-EJECTOR}L${EJECTOR} 0L0 ${EJECTOR}L${-EJECTOR} 0Z`;
const SIDE_CLASS = ["left", "right"] as const;

/**
 * The "water" in an ejector: `level` (0–1) of it, filled from the side facing
 * the board, with its surface parallel to the board edge. In the ejector's own
 * coordinates `u` runs along Left's push direction and `v` along Right's, both
 * from −½ to ½.
 */
function waterPath(side: Side, level: number): string {
  const p = (u: number, v: number) => `${((u - v) * EJECTOR).toFixed(2)} ${((u + v) * EJECTOR).toFixed(2)}`;
  const surface = 0.5 - level;
  return side === Side.Left
    ? `M${p(surface, -0.5)}L${p(0.5, -0.5)}L${p(0.5, 0.5)}L${p(surface, 0.5)}Z`
    : `M${p(-0.5, surface)}L${p(0.5, surface)}L${p(0.5, 0.5)}L${p(-0.5, 0.5)}Z`;
}

/**
 * Share of this turn's pushes still available on an ejector: every line of
 * the side to move is full before its first push; afterwards only the line
 * being pushed holds the pushes left.
 */
function pushesLeft(s: MatchSnapshot, side: Side, col: number): number {
  if (side !== s.turn || s.phase === "over" || s.phase === "waiting") return 0;
  if (s.pushes === 0) return 1;
  return col === s.activeLine ? (RULES.maxPushesPerTurn - s.pushes) / RULES.maxPushesPerTurn : 0;
}

/** Whether a key press activates a button (Enter or Space, not auto-repeated). */
function activates(e: KeyboardEvent): boolean {
  if ((e.key !== "Enter" && e.key !== " ") || e.repeat) return false;
  e.preventDefault();
  return true;
}

interface Props {
  match: MatchController;
  snapshot: MatchSnapshot;
}

export function BoardView({ match, snapshot: s }: Props) {
  const t = useMessages();
  const layout = new Layout(s.lCol, s.rCol);
  const transition: Transition = { duration: s.animMs / 1000, ease: "easeOut" };
  const [hover, setHover] = useState<{ side: Side; col: number } | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const turn = s.turn;
  const passable = canEndTurn(s);
  const pushable = (side: Side, col: number) => side === turn && canPush(s, col);
  const push = (side: Side, col: number) => {
    if (pushable(side, col)) match.push(col);
  };
  const endTurn = () => {
    if (passable) match.endTurn();
  };

  /** Hover highlighting; works for touch too (touch outside, then slide onto an ejector). */
  const onPointerMove = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>("[data-side]");
    const target = el ? { side: Number(el.dataset.side) as Side, col: Number(el.dataset.col) } : null;
    setHover(target && pushable(target.side, target.col) ? target : null);
  };

  const lineOf = (side: Side, col: number): string =>
    side === Side.Left
      ? layout.path([[-1, col], [s.rCol, col], [s.rCol, col + 1], [-1, col + 1]])
      : layout.path([[col, -1], [col + 1, -1], [col + 1, s.lCol], [col, s.lCol]]);

  const highlighted = hover && pushable(hover.side, hover.col) ? hover : turn !== null && s.activeLine !== null ? { side: turn, col: s.activeLine } : null;

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
    // Chevron pointing in the push direction: ↘ for Left, ↙ for Right.
    const arrow = { d: side === Side.Left ? "M-4 -14L10 0L-4 14" : "M4 -14L-10 0L4 14", transform: side === Side.Left ? "rotate(45)" : "rotate(-45)" };
    for (let col = 0; col < count; col++) {
      const cell = side === Side.Left ? { x: -1, y: col } : { x: col, y: -1 };
      const level = pushesLeft(s, side, col);
      const active = pushable(side, col);
      const water = waterPath(side, level);
      const clipId = `water-${side}-${col}`;
      ejectors.push(
        <motion.g
          key={`e${side}_${col}`}
          className={`ejector ejector-${SIDE_CLASS[side]}${level > 0 ? " is-lit" : ""}${active ? " is-active" : ""}`}
          data-side={side}
          data-col={col}
          role="button"
          tabIndex={active ? 0 : -1}
          aria-disabled={!active}
          aria-label={format(t.game.ejector, { side: side === Side.Left ? t.names.green : t.names.blue, n: col + 1 })}
          onClick={() => push(side, col)}
          onKeyDown={(e) => activates(e) && push(side, col)}
          initial={mounted.current ? { ...layout.place(cell), scale: 0 } : false}
          animate={layout.place(cell)}
          transition={transition}
        >
          <clipPath id={clipId}>
            <motion.path initial={false} animate={{ d: water }} transition={transition} />
          </clipPath>
          <path className="ejector-cell" d={INSET_DIAMOND} />
          <motion.path className="ejector-water" initial={false} animate={{ d: water }} transition={transition} />
          {/* The chevron is in the side's colour above the water and white under it. */}
          <path className="ejector-arrow" {...arrow} />
          <g clipPath={`url(#${clipId})`}>
            <path className="ejector-arrow is-under-water" {...arrow} />
          </g>
        </motion.g>,
      );
    }
  }

  const timerCenter = layout.center({ x: -1, y: -1 });
  const h = layout.h;
  const boardPath = layout.path([[0, 0], [s.rCol, 0], [s.rCol, s.lCol], [0, s.lCol]]);
  const { x: cx, y: cy } = timerCenter;

  return (
    <svg className="board" viewBox={`0 0 ${SIZE} ${SIZE}`} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)} onContextMenu={(e) => e.preventDefault()}>
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

      {/* Once the player has pushed, the timer doubles as the "end turn" button, like a chess clock. */}
      <g
        className={`timer${passable ? " is-active" : ""}`}
        role="button"
        tabIndex={passable ? 0 : -1}
        aria-disabled={!passable}
        aria-label={t.game.endTurn}
        onClick={endTurn}
        onKeyDown={(e) => activates(e) && endTurn()}
      >
        {passable && <title>{t.game.endTurn}</title>}
        <path d={layout.path([[-1, -1], [0, -1], [0, 0], [-1, 0]])} className="timer-cell" />
        {s.timer && turn !== null && (
          <g clipPath="url(#timer-clip)">
            <TimerFill key={s.timer.endsAt} timer={s.timer} x={cx - h} top={cy - h} size={2 * h} side={turn} />
          </g>
        )}
        {passable && <path className="timer-end" d={`M${cx - 0.32 * h} ${cy}L${cx - 0.08 * h} ${cy + 0.24 * h}L${cx + 0.34 * h} ${cy - 0.2 * h}`} strokeWidth={0.12 * h} />}
      </g>

      <g>{ejectors}</g>

      {/* Hint: the next ball, faded, just outside the hovered ejector it would be pushed in by. */}
      {hover && pushable(hover.side, hover.col) && s.next !== null && (
        <g
          className="next-preview"
          pointerEvents="none"
          transform={(({ x, y, scale }) => `translate(${x} ${y}) scale(${scale})`)(layout.place(hover.side === Side.Left ? { x: -2, y: hover.col } : { x: hover.col, y: -2 }))}
        >
          <BallShape ball={s.next} />
        </g>
      )}

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
