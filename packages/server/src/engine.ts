import { loadEngineSync } from "@myomyw/engine/node";

/** The rules engine (WebAssembly), shared by all rooms. */
export const engine = loadEngineSync();
