import { Engine } from "@myomyw/engine";
import wasmUrl from "@myomyw/engine/wasm?url";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { setEngine } from "./engine.ts";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

// The rules engine is WebAssembly (≈40 KB); load it before anything else.
Engine.load(fetch(wasmUrl)).then(
  (engine) => {
    setEngine(engine);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  },
  (error: unknown) => {
    console.error("Could not load the game engine", error);
    root.render(
      <div className="fatal" role="alert">
        <h1>Myomyw</h1>
        <p>The game could not start. Please reload the page, or use an up-to-date browser (WebAssembly is required).</p>
        <p lang="zh">游戏无法启动。请刷新页面，或使用最新版本的浏览器（需要支持 WebAssembly）。</p>
      </div>,
    );
  },
);
