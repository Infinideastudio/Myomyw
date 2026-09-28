import { readFileSync } from "node:fs";

export interface LegacyGameNode {
  lCol: number;
  rCol: number;
  chessmen: number[][];
  moveOnce(side: number, col: number, next: number): number;
  flip(): void;
}

export interface Legacy {
  GameNode: new (chessmen: number[][], lCol: number, rCol: number) => LegacyGameNode;
}

const source = ["definitions.js", "GameNode.js"]
  .map((file) => readFileSync(new URL(`./legacy/${file}`, import.meta.url), "utf8"))
  .join("\n");

/** Loads the original rules implementation (Beta 0.8) in an isolated scope. */
export function loadLegacy(): Legacy {
  const factory = new Function(`${source}\nreturn { GameNode: GameNode };`);
  return factory() as Legacy;
}
