import type { Engine } from "@myomyw/engine";

let current: Engine | null = null;

/** The rules engine (WebAssembly), loaded once at startup by main.tsx. */
export function engine(): Engine {
  if (!current) throw new Error("The engine has not been loaded");
  return current;
}

export function setEngine(loaded: Engine): void {
  current = loaded;
}
