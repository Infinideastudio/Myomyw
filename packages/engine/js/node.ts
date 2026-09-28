/** Loads the engine in Node from the built module (`npm run build:wasm`). */
import { readFileSync } from "node:fs";
import { Engine } from "./index.ts";

export function loadEngineSync(): Engine {
  return Engine.fromBytes(readFileSync(new URL("../dist/myomyw_engine.wasm", import.meta.url)));
}
