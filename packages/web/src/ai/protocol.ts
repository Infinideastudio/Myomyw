import type { Ball, BoardSnapshot } from "@myomyw/engine";

/** Messages from the page to the AI worker. Agents are identified by page-assigned ids. */
export type WorkerRequest =
  | { op: "create"; agent: number; spec: string; seed: number }
  | { op: "begin"; agent: number; board: BoardSnapshot }
  | { op: "first"; id: number; agent: number; next: Ball }
  | { op: "again"; id: number; agent: number; next: Ball }
  | { op: "free"; agent: number };

/** Replies to "first" / "again" requests, with the agent's estimated chance of winning afterwards. */
export type WorkerResponse = { id: number; value: number; estimate: number | null } | { id: number; error: string };
