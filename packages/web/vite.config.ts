import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build can be hosted under any sub-path.
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  // The AI worker imports ES modules.
  worker: { format: "es" },
  server: { port: 5173 },
});
