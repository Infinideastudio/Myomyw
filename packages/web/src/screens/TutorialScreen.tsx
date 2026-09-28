import { useState } from "react";
import { GameLayout, useMatchSnapshot } from "../components/GameLayout.tsx";
import { Button } from "../components/ui.tsx";
import { useMessages } from "../i18n/index.tsx";
import { TUTORIAL_STEPS, TutorialMatch } from "../match/TutorialMatch.ts";
import { useController } from "../match/useController.ts";
import type { Navigate } from "../routes.ts";
import { updateSettings, useSettings } from "../settings.ts";

export function TutorialScreen({ navigate }: { navigate: Navigate }) {
  const t = useMessages();
  const settings = useSettings();
  const [round, setRound] = useState(0);
  const match = useController(() => new TutorialMatch(settings.name || t.names.you, t.names.computer), [round]);
  if (!match) return null;

  const finish = () => {
    updateSettings({ tutorialOffered: true });
    navigate({ name: "home" });
  };

  return (
    <GameLayout
      match={match}
      title={t.tutorial.title}
      leave={{ label: t.game.exit, confirmBody: null, onLeave: finish }}
      resultActions={
        <>
          <Button onClick={finish}>{t.game.menu}</Button>
          <Button variant="primary" autoFocus onClick={() => setRound((r) => r + 1)}>
            {t.game.playAgain}
          </Button>
        </>
      }
    >
      <TutorialText match={match} onFinish={finish} />
    </GameLayout>
  );
}

function TutorialText({ match, onFinish }: { match: TutorialMatch; onFinish: () => void }) {
  const t = useMessages();
  const s = useMatchSnapshot(match);
  const step = s.tutorialStep ?? 0;
  const last = step === TUTORIAL_STEPS - 1;
  return (
    <section className="tutorial" aria-live="polite">
      <p className="tutorial-progress">
        {step + 1} / {TUTORIAL_STEPS}
      </p>
      <p>{t.tutorial.steps[step]}</p>
      {match.waitsForNext && (
        <Button variant="primary" autoFocus onClick={last ? onFinish : () => match.advance()}>
          {step === 0 ? t.common.start : last ? t.common.finish : t.common.next}
        </Button>
      )}
    </section>
  );
}
