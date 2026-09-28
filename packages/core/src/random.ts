import { Ball } from "./constants.ts";

/** A source of uniformly distributed numbers in [0, 1), like `Math.random`. */
export type Rng = () => number;

/**
 * Draws a ball from the official distribution: each special kind has
 * probability 1/11 and a common ball has probability 7/11.
 *
 * (Older documentation claimed 6/10 and 1/10; the game has always used
 * elevenths. Note that the "Strong" AI internally *weights* samples with
 * 0.6 / 0.1 — that mismatch is part of its algorithm and is kept as is.)
 */
export function randomBall(rng: Rng = Math.random): Ball {
  switch (Math.floor(rng() * 11)) {
    case 0:
      return Ball.Key;
    case 1:
      return Ball.AddCol;
    case 2:
      return Ball.DelCol;
    case 3:
      return Ball.Flip;
    default:
      return Ball.Common;
  }
}

/** Small, fast, seedable PRNG (mulberry32). Useful for reproducible games and tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
