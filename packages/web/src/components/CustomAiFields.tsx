import { IMPOSSIBLE_MCTS, MAX_MCTS_ITERS, type MctsSettings } from "@myomyw/engine";
import { useState } from "react";
import { format, useMessages } from "../i18n/index.tsx";
import { getSettings, updateSettings, useSettings } from "../settings.ts";

function save(patch: Partial<MctsSettings>): void {
  updateSettings({ customAi: { ...getSettings().customAi, ...patch } });
}

/**
 * Settings of the "Custom (MCTS)" computer player, saved as they change.
 * Number fields keep what is typed; only valid values are saved, and leaving
 * a field shows the saved value again.
 */
export function CustomAiFields() {
  const t = useMessages();
  const c = t.customAi;
  const { customAi } = useSettings();
  const [iters, setIters] = useState(String(customAi.iters));
  const [puct, setPuct] = useState(String(customAi.puct));
  return (
    <div className="custom-ai">
      <label className="field">
        <span>{c.iters}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_MCTS_ITERS}
          step={1}
          value={iters}
          onChange={(e) => {
            setIters(e.target.value);
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1 && n <= MAX_MCTS_ITERS) save({ iters: n });
          }}
          onBlur={() => setIters(String(getSettings().customAi.iters))}
        />
        <small>{format(c.itersHint, { iters: IMPOSSIBLE_MCTS.iters.toLocaleString() })}</small>
      </label>

      <label className="field">
        <span>{c.exploration}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0.05}
          max={20}
          step={0.1}
          value={puct}
          onChange={(e) => {
            setPuct(e.target.value);
            const x = Number(e.target.value);
            if (e.target.value.trim() !== "" && x > 0 && x <= 20) save({ puct: x });
          }}
          onBlur={() => setPuct(String(getSettings().customAi.puct))}
        />
        <small>{format(c.explorationHint, { puct: IMPOSSIBLE_MCTS.puct })}</small>
      </label>
    </div>
  );
}
