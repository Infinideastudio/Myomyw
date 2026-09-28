import { readFileSync } from "node:fs";
import type { Rng } from "../src/index.ts";

export interface LegacyGameNode {
  lCol: number;
  rCol: number;
  chessmen: number[][];
  moveOnce(side: number, col: number, next: number): number;
  flip(): void;
}

export interface LegacyAI {
  name: string;
  loadGame(node: LegacyGameNode): void;
  firstMove(next: number): number;
  continue(next: number): boolean;
}

export interface Legacy {
  GameNode: new (chessmen: number[][], lCol: number, rCol: number) => LegacyGameNode;
  WeakAI: new () => LegacyAI;
  StrongAI: new (maxDepth: number, fillout: number) => LegacyAI;
}

const source = ["definitions.js", "GameNode.js", "AI.js"]
  .map((file) => readFileSync(new URL(`./legacy/${file}`, import.meta.url), "utf8"))
  .join("\n");

/**
 * Loads the original JavaScript in an isolated scope whose `Math.random` is
 * `rng`. Each call returns fresh classes bound to their own random stream.
 */
export function loadLegacy(rng: Rng = Math.random): Legacy {
  const sandboxMath = Object.create(Math) as Math;
  sandboxMath.random = rng;
  const factory = new Function("Math", `${source}\nreturn { GameNode: GameNode, WeakAI: WeakAI, StrongAI: StrongAI };`);
  return factory(sandboxMath) as Legacy;
}
