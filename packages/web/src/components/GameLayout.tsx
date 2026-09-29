import { RULES, Side, opponent } from "@myomyw/engine";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { format, useMessages } from "../i18n/index.tsx";
import type { MatchController, MatchSnapshot } from "../match/types.ts";
import { BallIcon } from "./BallGlyph.tsx";
import { BoardView } from "./BoardView.tsx";
import { Button, Dialog } from "./ui.tsx";

export function useMatchSnapshot(match: MatchController): MatchSnapshot {
  return useSyncExternalStore(match.subscribe, match.getSnapshot);
}

interface Props {
  match: MatchController;
  title: string;
  /** Sides played by a computer (shows "Thinking…"). */
  computerSides?: readonly Side[];
  /** Show the computer's estimated chances of winning (a computer player that estimates them is playing). */
  showWinChance?: boolean;
  /** Extra panel content (tutorial text, chat...). */
  children?: ReactNode;
  /** Label of the leave button and whether leaving needs confirmation. */
  leave: { label: string; confirmBody: string | null; onLeave: () => void };
  /** Buttons shown in the result dialog. */
  resultActions: ReactNode;
  /** Overrides the result title, e.g. "You win!". */
  resultTitle?: (s: MatchSnapshot) => string;
}

/** The in-game screen: the next ball and the board, plus a side panel with the players and actions. */
export function GameLayout({ match, title, computerSides = [], showWinChance = false, children, leave, resultActions, resultTitle }: Props) {
  const t = useMessages();
  const s = useMatchSnapshot(match);
  const [confirming, setConfirming] = useState(false);
  const inProgress = s.phase !== "over" && s.phase !== "waiting";

  const askLeave = () => {
    if (inProgress && leave.confirmBody !== null) setConfirming(true);
    else leave.onLeave();
  };

  const result = s.result;
  const loserName = result ? s.names[opponent(result.winner)] : "";
  const humanTurn = s.turn !== null && s.controllable[s.turn];

  return (
    <div className={showWinChance ? "game has-win-bar" : "game"}>
      {showWinChance && <WinBar chance={s.winChance} />}
      <div className="game-main">
        <div className="next-ball">
          <span>{t.game.next}</span>
          <span className="next-ball-slot">{s.next !== null && <BallIcon key={`${s.next}-${s.pushes}-${s.turn}`} ball={s.next} size={40} />}</span>
          <Countdown snapshot={s} />
        </div>
        <div className="game-board">
          <BoardView match={match} snapshot={s} />
        </div>
      </div>
      <aside className="game-panel">
        <div className="panel-top">
          <span className="panel-title">{title}</span>
        </div>

        <div className="players">
          {[Side.Left, Side.Right].map((side) => (
            <PlayerCard key={side} side={side} snapshot={s} computer={computerSides.includes(side)} />
          ))}
        </div>

        {humanTurn && s.phase === "idle" && s.tutorialStep === undefined && <p className="hint">{t.game.pushHint}</p>}
        {children}

        <div className="panel-bottom">
          <Button variant="ghost" onClick={askLeave}>
            {leave.label}
          </Button>
        </div>
      </aside>

      <Dialog open={confirming} title={t.game.leaveTitle} onClose={() => setConfirming(false)}>
        <p>{leave.confirmBody}</p>
        <div className="dialog-actions">
          <Button onClick={() => setConfirming(false)}>{t.common.cancel}</Button>
          <Button variant="danger" onClick={leave.onLeave}>
            {leave.label}
          </Button>
        </div>
      </Dialog>

      <Dialog open={result !== null}>
        {result && (
          <div className={`result result-${result.winner === Side.Left ? "left" : "right"}`}>
            <h2>{resultTitle ? resultTitle(s) : format(t.result.wins, { name: s.names[result.winner] })}</h2>
            <p>{format(t.result[result.reason], { loser: loserName })}</p>
            <div className="dialog-actions">{resultActions}</div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function PlayerCard({ side, snapshot: s, computer }: { side: Side; snapshot: MatchSnapshot; computer: boolean }) {
  const t = useMessages();
  const isTurn = s.turn === side && s.phase !== "over" && s.phase !== "waiting";
  const status = !isTurn ? "" : s.controllable[side] && s.controllable[opponent(side)] === false ? t.game.yourTurn : computer && s.phase === "idle" ? t.game.thinking : format(t.game.turnOf, { name: s.names[side] });
  return (
    <div className={`player player-${side === Side.Left ? "left" : "right"}${isTurn ? " is-turn" : ""}`} aria-current={isTurn}>
      <span className="player-dot" aria-hidden />
      <div className="player-text">
        <strong>{s.names[side]}</strong>
        <span className="player-status">{status || " "}</span>
      </div>
      <div className="pips" aria-label={`${t.game.pushes}: ${isTurn ? s.pushes : 0}/${RULES.maxPushesPerTurn}`}>
        {Array.from({ length: RULES.maxPushesPerTurn }, (_, i) => (
          <span key={i} className={isTurn && i < s.pushes ? "pip is-on" : "pip"} />
        ))}
      </div>
    </div>
  );
}

/** Green's (left) and Blue's (right) estimated chances of winning; even until the first estimate. */
function WinBar({ chance }: { chance: number | null }) {
  const t = useMessages();
  const green = Math.round((chance ?? 0.5) * 100);
  return (
    <div className="win-bar" role="meter" aria-label={t.game.winEstimate} aria-valuemin={0} aria-valuemax={100} aria-valuenow={green} title={t.game.winEstimate}>
      <div className="win-bar-left" style={{ width: `${green}%` }}>
        {chance !== null && `${green}%`}
      </div>
      <div className="win-bar-right">{chance !== null && `${100 - green}%`}</div>
    </div>
  );
}

/** Seconds left for the first push of the turn. */
function Countdown({ snapshot: s }: { snapshot: MatchSnapshot }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!s.timer) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [s.timer]);
  if (!s.timer) return <span className="countdown" />;
  const seconds = Math.max(0, Math.ceil((s.timer.endsAt - performance.now()) / 1000));
  return <span className={`countdown${seconds <= 5 ? " is-low" : ""}`}>{seconds}s</span>;
}
