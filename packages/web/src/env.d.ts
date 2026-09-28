/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Default WebSocket URL of the game server, e.g. wss://example.com/myomyw */
  readonly VITE_SERVER_URL?: string;
}
