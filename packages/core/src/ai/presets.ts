import type { Rng } from "../random.ts";
import type { Agent } from "./agent.ts";
import { StrongAI } from "./strong.ts";
import { WeakAI } from "./weak.ts";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

/** The built-in opponents. */
export function createAgent(difficulty: Difficulty, rng: Rng = Math.random): Agent {
  switch (difficulty) {
    case "easy":
      return new WeakAI();
    case "normal":
      return new StrongAI(1, 10, rng);
    case "hard":
      return new StrongAI(2, 10, rng);
  }
}

/**
 * Parses an agent spec, as used by the arena:
 *   easy | normal | hard            the built-in opponents
 *   strong:<maxDepth>,<fillout>     StrongAI with custom settings
 */
export function agentFromSpec(spec: string, rng: Rng = Math.random): Agent {
  const custom = /^strong:(\d+),(\d+)$/.exec(spec);
  if (custom) return new StrongAI(Number(custom[1]), Number(custom[2]), rng);
  if ((DIFFICULTIES as readonly string[]).includes(spec)) return createAgent(spec as Difficulty, rng);
  throw new Error(`Unknown agent "${spec}"`);
}
