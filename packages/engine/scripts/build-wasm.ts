/**
 * Builds the engine for WebAssembly into dist/myomyw_engine.wasm.
 * Requires the Rust target: rustup target add wasm32-unknown-unknown
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const build = spawnSync("cargo", ["build", "--release", "--lib", "--target", "wasm32-unknown-unknown", "-p", "myomyw-engine"], {
  cwd: root,
  stdio: "inherit",
});
if (build.status !== 0) {
  console.error("WebAssembly build failed. Is the target installed? rustup target add wasm32-unknown-unknown");
  process.exit(build.status ?? 1);
}
const output = fileURLToPath(new URL("../dist/myomyw_engine.wasm", import.meta.url));
mkdirSync(fileURLToPath(new URL("../dist/", import.meta.url)), { recursive: true });
copyFileSync(`${root}target/wasm32-unknown-unknown/release/myomyw_engine.wasm`, output);
console.log(`Built ${output} (${(statSync(output).size / 1024).toFixed(1)} KiB)`);
