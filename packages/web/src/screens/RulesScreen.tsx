import { Ball } from "@myomyw/core";
import { BallIcon } from "../components/BallGlyph.tsx";
import { Page } from "../components/ui.tsx";
import { useMessages } from "../i18n/index.tsx";
import type { Navigate } from "../routes.ts";

export function RulesScreen({ navigate }: { navigate: Navigate }) {
  const t = useMessages();
  const r = t.rules;
  const balls: [Ball, string][] = [
    [Ball.Common, r.common],
    [Ball.Key, r.key],
    [Ball.AddCol, r.addCol],
    [Ball.DelCol, r.delCol],
    [Ball.Flip, r.flip],
  ];
  return (
    <Page title={r.title} onBack={() => navigate({ name: "home" })}>
      <article className="rules">
        <h2>{r.goalTitle}</h2>
        <p>{r.goal}</p>
        <h2>{r.boardTitle}</h2>
        <p>{r.board}</p>
        <h2>{r.turnTitle}</h2>
        <ol>
          {r.turn.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <h2>{r.ballsTitle}</h2>
        <ul className="ball-list">
          {balls.map(([ball, text]) => (
            <li key={ball}>
              <BallIcon ball={ball} size={32} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <h2>{r.nextTitle}</h2>
        <p>{r.next}</p>
        <h2>{r.timerTitle}</h2>
        <p>{r.timer}</p>
      </article>
    </Page>
  );
}
