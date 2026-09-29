/// <reference lib="webworker" />
/**
 * Runs computer players off the main thread, in the WebAssembly engine.
 * Requests are handled strictly in order.
 */
import { Engine, type WasmAgent } from "@myomyw/engine";
import wasmUrl from "@myomyw/engine/wasm?url";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

const engine = Engine.load(fetch(wasmUrl));
const agents = new Map<number, WasmAgent>();
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  queue = queue.then(() => handle(request)).catch((error: unknown) => console.error("AI worker:", error));
};

async function handle(request: WorkerRequest): Promise<void> {
  switch (request.op) {
    case "create":
      agents.set(request.agent, (await engine).createAgent(request.spec, request.seed));
      break;
    case "begin":
      agents.get(request.agent)?.beginTurn(request.board);
      break;
    case "first":
    case "again": {
      let response: WorkerResponse;
      try {
        const agent = agents.get(request.agent);
        if (!agent) throw new Error(`No agent ${request.agent}`);
        const value = request.op === "first" ? agent.firstPush(request.next) : Number(agent.pushAgain(request.next));
        response = { id: request.id, value, estimate: agent.winEstimate() };
      } catch (error) {
        response = { id: request.id, error: String(error) };
      }
      self.postMessage(response);
      break;
    }
    case "free":
      agents.get(request.agent)?.free();
      agents.delete(request.agent);
      break;
  }
}
