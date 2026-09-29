import { Ball } from "@myomyw/engine";
import { MAX_NAME_LENGTH } from "@myomyw/protocol";
import { useState } from "react";
import { BallIcon } from "../components/BallGlyph.tsx";
import { CustomAiFields } from "../components/CustomAiFields.tsx";
import { Button, Dialog } from "../components/ui.tsx";
import { useMessages } from "../i18n/index.tsx";
import { OPPONENTS, type Navigate, type Opponent } from "../routes.ts";
import { serverUrl, updateSettings, useSettings } from "../settings.ts";

export function HomeScreen({ navigate }: { navigate: Navigate }) {
  const t = useMessages();
  const settings = useSettings();
  const [dialog, setDialog] = useState<"difficulty" | "custom" | "aiVsAi" | null>(null);
  const [nameError, setNameError] = useState(false);
  const [noServer, setNoServer] = useState(false);
  const name = settings.name.trim();

  const playOnline = () => {
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) return setNameError(true);
    if (serverUrl(settings) === null) return setNoServer(true);
    navigate({ name: "online" });
  };

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-balls" aria-hidden>
          {[Ball.Common, Ball.AddCol, Ball.Key, Ball.DelCol, Ball.Flip].map((b) => (
            <BallIcon key={b} ball={b} size={34} />
          ))}
        </div>
        <h1 className="logo">Myomyw</h1>
        <p className="tagline">{t.tagline}</p>
      </header>

      <main className="home-main">
        {!settings.tutorialOffered && (
          <div className="banner">
            <p>{t.home.newHere}</p>
            <div className="banner-actions">
              <Button variant="ghost" onClick={() => updateSettings({ tutorialOffered: true })}>
                {t.home.dismiss}
              </Button>
              <Button variant="primary" onClick={() => navigate({ name: "tutorial" })}>
                {t.home.tutorial}
              </Button>
            </div>
          </div>
        )}

        <label className="field">
          <span>{t.home.yourName}</span>
          <input
            value={settings.name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t.home.namePlaceholder}
            autoComplete="nickname"
            aria-invalid={nameError}
            onChange={(e) => {
              setNameError(false);
              updateSettings({ name: e.target.value });
            }}
          />
          {nameError && <small className="field-error">{t.home.nameRequired}</small>}
        </label>

        <nav className="menu">
          <Button variant="primary" onClick={() => setDialog("difficulty")}>
            {t.home.vsComputer}
          </Button>
          <Button variant="primary" onClick={() => navigate({ name: "twoPlayers" })}>
            {t.home.twoPlayers}
          </Button>
          <Button variant="primary" onClick={playOnline}>
            {t.home.online}
          </Button>
          {noServer && (
            <p className="field-error" role="alert">
              {t.home.noServer}{" "}
              <button type="button" className="link" onClick={() => navigate({ name: "settings" })}>
                {t.home.settings}
              </button>
            </p>
          )}
          <Button onClick={() => setDialog("aiVsAi")}>{t.home.aiVsAi}</Button>
        </nav>

        <nav className="menu-secondary">
          <Button variant="ghost" onClick={() => navigate({ name: "tutorial" })}>
            {t.home.tutorial}
          </Button>
          <Button variant="ghost" onClick={() => navigate({ name: "rules" })}>
            {t.home.rules}
          </Button>
          <Button variant="ghost" onClick={() => navigate({ name: "settings" })}>
            {t.home.settings}
          </Button>
        </nav>
      </main>

      <Dialog open={dialog === "difficulty"} title={t.home.chooseDifficulty} onClose={() => setDialog(null)}>
        <div className="choice-row">
          {OPPONENTS.map((difficulty) => (
            <Button
              key={difficulty}
              variant={difficulty === "custom" ? "secondary" : "primary"}
              onClick={() => (difficulty === "custom" ? setDialog("custom") : navigate({ name: "vsComputer", difficulty }))}
            >
              {t.difficulty[difficulty]}
            </Button>
          ))}
        </div>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={() => setDialog(null)}>
            {t.common.cancel}
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === "custom"} title={t.difficulty.custom} onClose={() => setDialog(null)}>
        <CustomAiFields />
        <div className="dialog-actions">
          <Button variant="ghost" onClick={() => setDialog("difficulty")}>
            {t.common.back}
          </Button>
          <Button variant="primary" onClick={() => navigate({ name: "vsComputer", difficulty: "custom" })}>
            {t.common.start}
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === "aiVsAi"} title={t.aiVsAi.title} onClose={() => setDialog(null)}>
        <AiVsAiForm navigate={navigate} onCancel={() => setDialog(null)} />
      </Dialog>
    </div>
  );
}

function AiVsAiForm({ navigate, onCancel }: { navigate: Navigate; onCancel: () => void }) {
  const t = useMessages();
  const [left, setLeft] = useState<Opponent>("hard");
  const [right, setRight] = useState<Opponent>("normal");
  const [quick, setQuick] = useState(false);
  const picker = (label: string, value: Opponent, set: (d: Opponent) => void) => (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {OPPONENTS.map((d) => (
        <label key={d}>
          <input type="radio" checked={value === d} onChange={() => set(d)} />
          <span>{t.difficulty[d]}</span>
        </label>
      ))}
    </fieldset>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ name: "aiVsAi", left, right, quick });
      }}
    >
      {picker(t.aiVsAi.green, left, setLeft)}
      {picker(t.aiVsAi.blue, right, setRight)}
      {(left === "custom" || right === "custom") && <CustomAiFields />}
      <label className="checkbox">
        <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
        <span>{t.aiVsAi.quick}</span>
      </label>
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button variant="primary" type="submit">
          {t.aiVsAi.start}
        </Button>
      </div>
    </form>
  );
}
