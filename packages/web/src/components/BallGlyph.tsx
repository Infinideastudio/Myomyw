import { Ball } from "@myomyw/core";

const FILL: Record<Ball, string> = {
  [Ball.Common]: "var(--ball-common)",
  [Ball.Key]: "var(--ball-key)",
  [Ball.AddCol]: "var(--ball-add)",
  [Ball.DelCol]: "var(--ball-del)",
  [Ball.Flip]: "var(--ball-flip)",
};

/**
 * A ball drawn around the origin with radius `r` (SVG fragment).
 * Each kind has both a color and a symbol, so they stay distinguishable
 * without color vision.
 */
export function BallShape({ ball, r = 26 }: { ball: Ball; r?: number }) {
  const s = r / 26; // symbols are designed for r = 26
  return (
    <g className="ball">
      <circle r={r} fill={FILL[ball]} />
      <circle r={r} fill="url(#ball-shine)" />
      {ball === Ball.Key && <circle r={7 * s} fill="none" stroke="var(--ball-symbol)" strokeWidth={4 * s} />}
      {ball === Ball.AddCol && <path d={`M${-11 * s} 0H${11 * s}M0 ${-11 * s}V${11 * s}`} stroke="var(--ball-symbol)" strokeWidth={5 * s} strokeLinecap="round" />}
      {ball === Ball.DelCol && <path d={`M${-11 * s} 0H${11 * s}`} stroke="var(--ball-symbol-dark)" strokeWidth={5 * s} strokeLinecap="round" />}
      {ball === Ball.Flip && (
        <g stroke="var(--ball-symbol)" strokeWidth={4 * s} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={`M${-11 * s} ${7 * s}C${-11 * s} ${-7 * s} ${9 * s} ${-9 * s} ${11 * s} ${3 * s}`} />
          <path d={`M${4 * s} ${2 * s}L${11 * s} ${4 * s}L${13 * s} ${-3 * s}`} />
        </g>
      )}
    </g>
  );
}

/** Shared SVG definitions; render once per SVG that uses {@link BallShape}. */
export function BallDefs() {
  return (
    <defs>
      <radialGradient id="ball-shine" cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </radialGradient>
    </defs>
  );
}

/** A standalone ball icon for use in HTML. */
export function BallIcon({ ball, size = 28, title }: { ball: Ball; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="-30 -30 60 60" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <BallDefs />
      <BallShape ball={ball} />
    </svg>
  );
}
