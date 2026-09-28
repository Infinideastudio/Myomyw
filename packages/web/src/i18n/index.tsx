import { createContext, useContext } from "react";
import { en, type Messages } from "./en.ts";
import { zhCN } from "./zh-CN.ts";
import { zhTW } from "./zh-TW.ts";

export type { Messages };
export type Language = "en" | "zh-CN" | "zh-TW";
export type LanguageSetting = Language | "auto";

export const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-TW", label: "正體中文" },
];

const MESSAGES: Record<Language, Messages> = { en, "zh-CN": zhCN, "zh-TW": zhTW };

/** Picks a supported language from the browser preferences. */
export function detectLanguage(preferred: readonly string[] = navigator.languages): Language {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    if (lower.startsWith("zh")) return /tw|hk|mo|hant/.test(lower) ? "zh-TW" : "zh-CN";
    if (lower.startsWith("en")) return "en";
  }
  return "en";
}

export function resolveLanguage(setting: LanguageSetting): Language {
  return setting === "auto" ? detectLanguage() : setting;
}

export function messagesFor(language: Language): Messages {
  return MESSAGES[language];
}

/** Replaces `{name}` placeholders. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export const MessagesContext = createContext<Messages>(en);

export function useMessages(): Messages {
  return useContext(MessagesContext);
}
