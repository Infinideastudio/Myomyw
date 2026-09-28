import { MAX_NAME_LENGTH } from "@myomyw/protocol";
import { Page } from "../components/ui.tsx";
import { LANGUAGES, format, useMessages, type LanguageSetting } from "../i18n/index.tsx";
import type { Navigate } from "../routes.ts";
import { defaultServerUrl, updateSettings, useSettings } from "../settings.ts";

export function SettingsScreen({ navigate }: { navigate: Navigate }) {
  const t = useMessages();
  const settings = useSettings();
  const defaultServer = defaultServerUrl();
  return (
    <Page title={t.settings.title} onBack={() => navigate({ name: "home" })}>
      <div className="settings">
        <label className="field">
          <span>{t.home.yourName}</span>
          <input value={settings.name} maxLength={MAX_NAME_LENGTH} placeholder={t.home.namePlaceholder} onChange={(e) => updateSettings({ name: e.target.value })} />
        </label>

        <label className="field">
          <span>{t.settings.language}</span>
          <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value as LanguageSetting })}>
            <option value="auto">{t.settings.auto}</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={settings.timer} onChange={(e) => updateSettings({ timer: e.target.checked })} />
          <span>
            {t.settings.timer}
            <small>{t.settings.timerHint}</small>
          </span>
        </label>

        <label className="field">
          <span>{t.settings.server}</span>
          <input value={settings.serverUrl} placeholder={defaultServer ?? "wss://…"} spellCheck={false} onChange={(e) => updateSettings({ serverUrl: e.target.value })} />
          <small>{defaultServer ? format(t.settings.serverHint, { url: defaultServer }) : t.settings.serverNone}</small>
        </label>

        <section className="about">
          <h2>{t.settings.about}</h2>
          <p>{format(t.settings.aboutText, { version: __APP_VERSION__ })}</p>
        </section>
      </div>
    </Page>
  );
}
