import { IMPOSSIBLE_MCTS, validMcts, type MctsSettings } from "@myomyw/engine";
import { useState } from "react";
import { format, useMessages } from "../i18n/index.tsx";
import { getSettings, updateSettings, useSettings } from "../settings.ts";

/** Saves a change if the result is valid; returns whether it was. */
function save(patch: Partial<MctsSettings>): boolean {
  const customAi = { ...getSettings().customAi, ...patch };
  if (!validMcts(customAi)) return false;
  updateSettings({ customAi });
  return true;
}

/** Parses a typed number, or NaN for anything else (including an empty field). */
function parse(text: string): number {
  return /^\s*\d*\.?\d+\s*$/.test(text) ? Number(text) : NaN;
}

/**
 * Settings of the "Custom (MCTS)" computer player, saved as they change.
 * Fields keep what is typed; only valid values are saved, an invalid field is
 * marked, and leaving it shows the saved value again.
 */
export function CustomAiFields() {
  const t = useMessages();
  const c = t.customAi;
  const { customAi } = useSettings();
  const [iters, setIters] = useState(String(customAi.iters));
  const [puct, setPuct] = useState(String(customAi.puct));
  const [invalid, setInvalid] = useState({ iters: false, puct: false });
  return (
    <div className="custom-ai">
      <label className="field">
        <span>{c.iters}</span>
        <input
          type="text"
          inputMode="numeric"
          value={iters}
          aria-invalid={invalid.iters}
          onChange={(e) => {
            setIters(e.target.value);
            setInvalid({ ...invalid, iters: !save({ iters: parse(e.target.value) }) });
          }}
          onBlur={() => {
            setIters(String(getSettings().customAi.iters));
            setInvalid({ ...invalid, iters: false });
          }}
        />
        <small>{format(c.itersHint, { iters: IMPOSSIBLE_MCTS.iters.toLocaleString() })}</small>
      </label>

      <label className="field">
        <span>{c.exploration}</span>
        <input
          type="text"
          inputMode="decimal"
          value={puct}
          aria-invalid={invalid.puct}
          onChange={(e) => {
            setPuct(e.target.value);
            setInvalid({ ...invalid, puct: !save({ puct: parse(e.target.value) }) });
          }}
          onBlur={() => {
            setPuct(String(getSettings().customAi.puct));
            setInvalid({ ...invalid, puct: false });
          }}
        />
        <small>{format(c.explorationHint, { puct: IMPOSSIBLE_MCTS.puct })}</small>
      </label>
    </div>
  );
}
