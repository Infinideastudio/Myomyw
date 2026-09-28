import type { Rng } from "../random.ts";
import type { Agent } from "./agent.ts";
import { StrongAI } from "./strong.ts";
import { WeakAI } from "./weak.ts";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

/** The three built-in opponents, exactly as configured in the original game. */
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
