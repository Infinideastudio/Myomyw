# Architecture

Myomyw is a monorepo of npm workspaces around one Rust crate:

```
packages/
  engine/    @myomyw/engine    rules + AI players in Rust → native and WebAssembly, with TS bindings
  protocol/  @myomyw/protocol  client/server message types
  server/    @myomyw/server    WebSocket game server + static hosting of the web client
  web/       @myomyw/web       React client (Vite)
docs/        rules, AI, protocol, this file
Cargo.toml   Rust workspace (member: packages/engine)
.github/workflows/pages.yml   CI: lint, test, build, deploy to GitHub Pages
```

The **engine is the single implementation of the rules and the AI**. Every
consumer uses it: the web client and the AI worker through WebAssembly, the
server through WebAssembly in Node, tournaments and benchmarks natively.

TypeScript packages import each other as source. The server and scripts run
directly on Node ≥ 22.18 (native type stripping, no build step); the web
client is bundled by Vite. The code therefore only uses *erasable* TypeScript
syntax (no `enum`, no parameter properties) and imports files with their `.ts`
extension. The WebAssembly module is built by `npm run build:wasm`, which
`npm run dev`, `npm run build` and `npm test` run first.

## `@myomyw/engine`

The crate `myomyw-engine` (no dependencies) and its TypeScript bindings:

| File | Contents |
| --- | --- |
| `src/ball.rs` | `Side`, `Ball`, rule constants |
| `src/board.rs` | `Board` as bitboards (below) |
| `src/game.rs` | `Game`, `Action` (`Push(line)` / `Stop`), `Game::actions()` / `apply()` — the Markov game of [rules.md §9](rules.md#9-formal-model-a-two-player-zero-sum-markov-game) |
| `src/rng.rs` | `Rng` (mulberry32); `Rng::ball()` draws from the official distribution |
| `src/ai/` | `Agent` trait, `WeakAi`, `StrongAi`, `PoolSearch`, `MctsAi`; `src/ai/value/`: the Impossible AI's network (value and policy heads) and its embedded weights ([ai.md](ai.md)) |
| `src/arena.rs` | `play_match`, multi-threaded `tournament` |
| `src/ffi.rs` | C ABI exported by the WebAssembly module |
| `src/bin/arena.rs`, `src/bin/bench.rs` | `npm run arena`, `npm run bench` |
| `src/bin/selfplay.rs`, `src/bin/train.rs`, `scripts/train.sh` | Self-play data and training of the value network |
| `js/types.ts` | TypeScript vocabulary: `Side`, `Ball`, `RULES`, `BoardSnapshot`, `GameResult`, … |
| `js/index.ts` | Bindings: `Engine.load` / `Engine.fromBytes`, `WasmGame`, `WasmAgent`, `WasmBoard` |
| `js/node.ts` | `loadEngineSync()` for Node |
| `scripts/build-wasm.ts` | `npm run build:wasm` → `dist/myomyw_engine.wasm` |

**Representation.** A board is four 128-bit one-hot planes — Key, Add line,
Remove line, Flip — with bit `l·10 + r` for cell (l, r); a cell with no bit is
a common ball, and bits outside the board are always zero. A push on a line is
one mask, one shift and one merge per plane; a board is an 80-byte `Copy`
value and a whole `Game` state barely more, so search and simulation copy
positions freely. The static evaluation walks only the (sparse) Key plane.

**Performance** (desktop, one thread): about 1.2 million random playouts per
second (≈60 million actions/s). `tournament` spreads games over all cores with
results independent of the thread count.

**WebAssembly.** Built for `wasm32-unknown-unknown` without `wasm-bindgen`:
the module (≈42 KB, 17 KB gzipped) has no imports and exports a few dozen
functions (`src/ffi.rs`). Objects are heap pointers owned by the caller; data
goes through a 108-byte I/O buffer (`[lCol, rCol, cells[100], turn, next,
pushes, column, winner, reason]`). `js/index.ts` wraps this in classes that
expose plain-data state (`BoardSnapshot`, `GameResult`, `PushOutcome`) and
frees forgotten objects with a `FinalizationRegistry`.

## `@myomyw/protocol`

Message types and `encode`/`decode` for the WebSocket protocol
([protocol.md](protocol.md)), plus shared limits (`PROTOCOL_VERSION`,
`MAX_NAME_LENGTH`, …).

## `@myomyw/server`

- `engine.ts` — loads the WebAssembly engine once at startup.
- `server.ts` — creates the HTTP server (serves `packages/web/dist` if built)
  and the WebSocket endpoint on the same port.
- `lobby.ts` — validates the `hello` message (protocol version, name), then
  pairs players first-come-first-served. The first player of a pair is Green.
- `room.ts` — one game. The room owns a `WasmGame`; clients only send intents
  and the room broadcasts every resulting event, so clients cannot desync or
  cheat. It times every action (by default 20 s per push or end of turn);
  clients learn the limit from `welcome`.
- `client.ts` — typed wrapper around a socket.

Configuration is via environment variables (`PORT`, `HOST`, `MAX_ROOMS`,
`MOTD`, `STATIC_DIR`, `TIME_LIMIT`); see `config.ts`.

## `@myomyw/web`

React 19 + Vite, SVG rendering, [Motion](https://motion.dev) for animation.
No global state library: screens are plain React state (`App.tsx` holds the
current `Route`), settings live in `localStorage` (`settings.ts`), and a match
is an external store read with `useSyncExternalStore`. `main.tsx` loads the
engine before rendering anything (`engine.ts` holds the instance).

```
src/
  engine.ts     the loaded engine instance
  match/        framework-agnostic match controllers (no React)
    types.ts        MatchSnapshot (what the UI renders) and MatchController (what it calls)
    display.ts      DisplayBoard: board + sprite ids for animation
    grid.ts         helpers to move sprite ids like the engine moves balls
    MatchBase.ts    snapshot store, timers, show{Shift,Effect,Turn,Result}
    LocalMatch.ts   offline games on a WasmGame: seats are human / AI / idle
    TutorialMatch.ts
    OnlineMatch.ts  replays server events (on a WasmBoard copy) through an animation queue
    timing.ts       animation pacing (the original's durations)
  ai/           computer players off the main thread
    agents.ts       AsyncAgent, workerAgent(spec), syncAgent(agent)
    worker.ts       Web Worker running WasmAgents
    protocol.ts     worker messages
  components/   BoardView (SVG board), GameLayout (board + side panel), dialogs, ball glyphs
  screens/      Home, LocalGame, Online, Tutorial, Rules, Settings
  i18n/         en, zh-CN, zh-TW dictionaries (typed: every language has every key)
```

### Match controllers

A `MatchController` exposes `push(col)` / `endTurn()` for human input and
publishes immutable `MatchSnapshot`s; `canPush` / `canEndTurn` say what a
human may do right now. The UI never touches game logic.

- **`LocalMatch`** owns a `WasmGame` and paces it: every human push is one
  click (300 ms animation, then a fresh clock for the next action), and the
  turn ends on `endTurn()`, after the 5th push or a Flip. An AI seat is asked
  `pushAgain` after every push and pauses 400 ms between pushes. A computer
  player is asked for its first push as soon as the previous turn ends, even
  before that turn's last push has been animated. A test asserts that it produces exactly the same games as driving
  the engine directly with the same seeds.
- **`OnlineMatch`** sends intents to the server and replays the server's
  `pushed` / `turn` / `over` events one animation at a time, applying each push
  to a `WasmBoard` copy of the server's board. If events pile up (network
  jitter) the queue plays them faster until it has caught up.
- **`TutorialMatch`** is a `LocalMatch` with an idle opponent, a scripted ball
  sequence and steps that place special balls on the board.

### Computer players

AI seats hold an `AsyncAgent`: the agent protocol with promise-returning
`firstPush` / `pushAgain`, so an agent may think for as long as it needs
without freezing the page. `workerAgent(spec)` creates the agent in one shared
Web Worker, which loads its own instance of the engine and runs `WasmAgent`s.
`LocalMatch` ignores answers that arrive after the situation changed (timeout,
match closed).

### Rendering

The board is an axis-aligned grid drawn rotated by 45°: `x` runs along
Green's lines, `y` along Blue's, ejectors sit at `x = −1` / `y = −1` and the
timer at `(−1, −1)` — the top corner. `Layout` in `BoardView.tsx` maps cells to
SVG coordinates for the current board size; every ball is a keyed element
that animates to its new position when the snapshot changes. This gives all
animations for free: pushes (balls slide one cell), flips (balls glide to their
mirrored cells), and resizes (the whole board rescales). Balls leaving the
board are rendered as short-lived "ghosts".

`DisplayBoard` shows each push in two steps: `shift` moves the balls (the push
animation), then `applyEffect` animates the effect and adopts the engine's
resulting board, so the display can never drift from the real game state.

Ejectors are drawn like the timer: each is filled with its side's colour to
the share of the turn's pushes still available on it, the "water" surface
running parallel to the board edge. Before the first push every ejector of
the side to move is full; afterwards only the line being pushed keeps its
water (4/5, 3/5, …) and the others dim.

Input: a click (or Enter / Space) on an ejector pushes; once the player has
pushed, the timer cell becomes the "end turn" button (chess-clock style). The
line under the pointer is highlighted while it can be pushed.

### Hosting

- **With the server** (`npm start`): the server hosts the built client, which
  connects to the same origin for online play.
- **Standalone** (GitHub Pages): built with `VITE_STANDALONE=true`, the client
  has no default server; online play then needs `VITE_SERVER_URL` at build
  time or a server entered in Settings. Asset paths are relative, so the site
  works under any sub-path.

## Testing

`npm test` builds the WebAssembly module, then runs Vitest over the
TypeScript packages and `cargo test`:

- `engine/test/engine.test.ts` — the WebAssembly engine against the **original
  Beta 0.8 rules code** (`test/legacy/GameNode.js`) over 60 000 random pushes,
  plus the `WasmGame` / `WasmAgent` bindings (turns, results, determinism,
  invalid input).
- Rust unit tests (`packages/engine/src/**`) — the bitboard board against a
  plain array model, turn logic and every rule, the ball distribution,
  alpha-beta soundness against plain negamax, AI behaviour, and
  thread-count-independent tournaments.
- `server/test/server.test.ts` — a real server with two WebSocket clients.
- `web/test/localMatch.test.ts` — the offline match controller on fake
  timers (one push per click, same line only, 5-push limit, per-action
  timeouts, the computer's head start, identical games to a direct engine
  game).

`npm run typecheck` type-checks the TypeScript packages; `cargo fmt --check`
and `cargo clippy -- -D warnings` lint the Rust crate. CI runs all of these
(see `.github/workflows/pages.yml`).
