import { DIFFICULTIES, type Difficulty } from "@myomyw/engine";

/** A computer opponent: a built-in difficulty, or the custom MCTS player configured in Settings. */
export type Opponent = Difficulty | "custom";
export const OPPONENTS: readonly Opponent[] = [...DIFFICULTIES, "custom"];

/** Every screen of the app. Navigation is plain state; there are no URLs to deep-link. */
export type Route =
  | { name: "home" }
  | { name: "vsComputer"; difficulty: Opponent }
  | { name: "twoPlayers" }
  | { name: "aiVsAi"; left: Opponent; right: Opponent; quick: boolean }
  | { name: "online" }
  | { name: "tutorial" }
  | { name: "rules" }
  | { name: "settings" };

export type Navigate = (route: Route) => void;
