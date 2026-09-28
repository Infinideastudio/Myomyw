/// <reference lib="webworker" />
/**
 * Runs computer players off the main thread, using the WebAssembly engine
 * (falling back to the TypeScript agents if WebAssembly is unavailable).
 * Requests are handled strictly in order.
 */
import { Board, agentFromSpec, seededRng, type Agent } from "@myomyw/core";
import { Engine } from "@myomyw/engine";
import wasmUrl from "@myomyw/engine/wasm?url";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

const engine = Engine.load(fetch(wasmUrl)).then(
  (loaded) => {
    console.info("Myomyw AI: using the WebAssembly engine");
    return loaded;
  },
  (error: unknown) => {
    console.warn("Myomyw AI: WebAssembly engine unavailable, using the TypeScript agents", error);
    return null;
  },
);

const agents = new Map<number, Agent & { free?: () => void }>();
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  queue = queue.then(() => handle(request));
};

async function handle(request: WorkerRequest): Promise<void> {
  switch (request.op) {
    case "create": {
      const wasm = await engine;
      agents.set(request.agent, wasm ? wasm.createAgent(request.spec, request.seed) : agentFromSpec(request.spec, seededRng(request.seed)));
      break;
    }
    case "begin":
      agents.get(request.agent)?.beginTurn(new Board(request.board.cells, request.board.lCol, request.board.rCol));
      break;
    case "first":
    case "again": {
      let response: WorkerResponse;
      try {
        const agent = agents.get(request.agent);
        if (!agent) throw new Error(`No agent ${request.agent}`);
        const value = request.op === "first" ? agent.firstPush(request.next) : Number(agent.pushAgain(request.next));
        response = { id: request.id, value };
      } catch (error) {
        response = { id: request.id, error: String(error) };
      }
      self.postMessage(response);
      break;
    }
    case "free":
      agents.get(request.agent)?.free?.();
      agents.delete(request.agent);
      break;
  }
}
