import { RULES } from "@myomyw/engine";
import { useSyncExternalStore } from "react";
import type { LanguageSetting } from "./i18n/index.tsx";

export interface Settings {
  name: string;
  language: LanguageSetting;
  /**
   * Offline games: seconds a human player has for the first push of each
   * turn; null for no limit. Online games use the server's limits.
   */
  timeLimit: number | null;
  /** Custom WebSocket URL of the game server; empty for the default. */
  serverUrl: string;
  /** Whether the tutorial suggestion on the home screen has been dismissed. */
  tutorialOffered: boolean;
}

const KEY = "myomyw.settings";
export const DEFAULT_TIME_LIMIT = RULES.turnTimeLimitMs / 1000;
const DEFAULTS: Settings = { name: "", language: "auto", timeLimit: DEFAULT_TIME_LIMIT, serverUrl: "", tutorialOffered: false };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Settings> & { timer?: boolean };
      // Older versions only had an on/off switch.
      if (stored.timer === false && !("timeLimit" in stored)) stored.timeLimit = null;
      delete stored.timer;
      return { ...DEFAULTS, ...stored };
    }
  } catch {
    // Storage unavailable or corrupted: fall back to defaults.
  }
  return { ...DEFAULTS };
}

let current = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Settings still apply for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}

/**
 * Where the game server is by default: `VITE_SERVER_URL` if set at build
 * time; none for a standalone build (`VITE_STANDALONE=true`, e.g. GitHub
 * Pages); the Vite dev server's host on port 8650 during development;
 * otherwise the origin that served this page (the game server hosts the client).
 */
export function defaultServerUrl(): string | null {
  const configured = import.meta.env.VITE_SERVER_URL;
  if (configured) return configured;
  if (import.meta.env.VITE_STANDALONE === "true") return null;
  if (import.meta.env.DEV) return `ws://${location.hostname}:8650`;
  const path = location.pathname.replace(/[^/]*$/, "");
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${path}`;
}

/** The server to play online with, or null if there is none. */
export function serverUrl(settings: Settings): string | null {
  return settings.serverUrl.trim() || defaultServerUrl();
}
