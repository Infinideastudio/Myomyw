import { Side } from "@myomyw/engine";
import { useState } from "react";
import { workerAgent } from "../ai/agents.ts";
import { GameLayout } from "../components/GameLayout.tsx";
import { Button } from "../components/ui.tsx";
import { useMessages, type Messages } from "../i18n/index.tsx";
import { LocalMatch, type LocalMatchOptions } from "../match/LocalMatch.ts";
import { NORMAL_TIMING, QUICK_TIMING } from "../match/timing.ts";
import { useController } from "../match/useController.ts";
import type { Navigate, Route } from "../routes.ts";
import { opponentSpec, useSettings, type Settings } from "../settings.ts";

type LocalRoute = Extract<Route, { name: "vsComputer" | "twoPlayers" | "aiVsAi" }>;

function matchOptions(route: LocalRoute, t: Messages, settings: Settings): LocalMatchOptions {
  const timeLimitMs = settings.timeLimit === null ? null : settings.timeLimit * 1000;
  switch (route.name) {
    case "vsComputer":
      return {
        seats: [{ kind: "human" }, { kind: "ai", agent: workerAgent(opponentSpec(route.difficulty, settings)) }],
        names: [settings.name || t.names.you, `${t.names.computer} · ${t.difficulty[route.difficulty]}`],
        timeLimitMs,
      };
    case "twoPlayers":
      return { seats: [{ kind: "human" }, { kind: "human" }], names: [t.names.green, t.names.blue], timeLimitMs };
    case "aiVsAi":
      return {
        seats: [
          { kind: "ai", agent: workerAgent(opponentSpec(route.left, settings)) },
          { kind: "ai", agent: workerAgent(opponentSpec(route.right, settings)) },
        ],
        names: [`${t.names.green} · ${t.difficulty[route.left]}`, `${t.names.blue} · ${t.difficulty[route.right]}`],
        timeLimitMs: null,
        timing: route.quick ? QUICK_TIMING : NORMAL_TIMING,
      };
  }
}

function title(route: LocalRoute, t: Messages): string {
  if (route.name === "vsComputer") return `${t.home.vsComputer} · ${t.difficulty[route.difficulty]}`;
  return route.name === "twoPlayers" ? t.home.twoPlayers : t.aiVsAi.title;
}

/** Human vs computer, two humans on one device, or computer vs computer. */
export function LocalGameScreen({ route, navigate }: { route: LocalRoute; navigate: Navigate }) {
  const t = useMessages();
  const settings = useSettings();
  const [round, setRound] = useState(0);
  // Settings are read when a round starts; changing them mid-game has no effect.
  const match = useController(() => new LocalMatch(matchOptions(route, t, settings)), [round]);
  if (!match) return null;

  const home = () => navigate({ name: "home" });
  const computerSides = route.name === "vsComputer" ? [Side.Right] : route.name === "aiVsAi" ? [Side.Left, Side.Right] : [];
  // Only the MCTS players (Impossible and Custom) estimate their chances.
  const opponents = route.name === "vsComputer" ? [route.difficulty] : route.name === "aiVsAi" ? [route.left, route.right] : [];
  const showWinChance = opponents.some((o) => o === "impossible" || o === "custom");

  return (
    <GameLayout
      match={match}
      title={title(route, t)}
      computerSides={computerSides}
      showWinChance={showWinChance}
      leave={{ label: t.game.exit, confirmBody: route.name === "aiVsAi" ? null : t.game.leaveBody, onLeave: home }}
      resultTitle={route.name === "vsComputer" ? (s) => (s.result!.winner === Side.Left ? t.result.youWin : t.result.youLose) : undefined}
      resultActions={
        <>
          <Button onClick={home}>{t.game.menu}</Button>
          <Button variant="primary" autoFocus onClick={() => setRound((r) => r + 1)}>
            {t.game.playAgain}
          </Button>
        </>
      }
    />
  );
}
