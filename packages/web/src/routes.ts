import type { Difficulty } from "@myomyw/core";

/** Every screen of the app. Navigation is plain state; there are no URLs to deep-link. */
export type Route =
  | { name: "home" }
  | { name: "vsComputer"; difficulty: Difficulty }
  | { name: "twoPlayers" }
  | { name: "aiVsAi"; left: Difficulty; right: Difficulty; quick: boolean }
  | { name: "online" }
  | { name: "tutorial" }
  | { name: "rules" }
  | { name: "settings" };

export type Navigate = (route: Route) => void;
