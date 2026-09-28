import { randomSeed, type Ball, type BoardSnapshot, type WasmAgent } from "@myomyw/engine";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";

/**
 * A computer player whose decisions may take time (e.g. computed in a Web
 * Worker). Same protocol as `WasmAgent` (docs/ai.md), with asynchronous answers.
 */
export interface AsyncAgent {
  beginTurn(view: BoardSnapshot): void;
  firstPush(next: Ball): Promise<number>;
  pushAgain(next: Ball): Promise<boolean>;
  dispose(): void;
}

/** Wraps an agent running on the calling thread (tests, tools). Disposing frees it. */
export function syncAgent(agent: WasmAgent): AsyncAgent {
  return {
    beginTurn: (view) => agent.beginTurn(view),
    firstPush: async (next) => agent.firstPush(next),
    pushAgain: async (next) => agent.pushAgain(next),
    dispose: () => agent.free(),
  };
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (value: number) => void; reject: (error: Error) => void }>();

function aiWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    pending.delete(response.id);
    if ("error" in response) request?.reject(new Error(response.error));
    else request?.resolve(response.value);
  };
  worker.onerror = (event) => {
    for (const request of pending.values()) request.reject(new Error(`AI worker failed: ${event.message}`));
    pending.clear();
  };
  return worker;
}

/**
 * A computer player running in the shared AI worker. `spec` is an agent
 * spec such as "hard" (see `Engine.createAgent`).
 */
export function workerAgent(spec: string, seed: number = randomSeed()): AsyncAgent {
  const agent = nextId++;
  const send = (request: WorkerRequest) => aiWorker().postMessage(request);
  const ask = (op: "first" | "again", next: Ball) =>
    new Promise<number>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ op, id, agent, next });
    });
  send({ op: "create", agent, spec, seed });
  return {
    beginTurn: (view) => send({ op: "begin", agent, board: { cells: view.cells, lCol: view.lCol, rCol: view.rCol } }),
    firstPush: (next) => ask("first", next),
    pushAgain: async (next) => (await ask("again", next)) === 1,
    dispose: () => send({ op: "free", agent }),
  };
}
