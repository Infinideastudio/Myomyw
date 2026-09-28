# Architecture

Myomyw is a monorepo of npm workspaces plus one Rust crate:

```
packages/
  core/     @myomyw/core    TypeScript rules engine, AI players, protocol types  (no dependencies)
  engine/   @myomyw/engine  Rust engine (rules + AI), native and WebAssembly, with TS bindings
  server/   @myomyw/server  WebSocket game server + static hosting of the web client
  web/      @myomyw/web     React client (Vite)
docs/       rules, AI, protocol, this file
Cargo.toml  Rust workspace (member: packages/engine)
```

There are two implementations of the rules and AIs, with distinct roles:

- **`core` (TypeScript)** is the reference used by the game itself: the server
  runs it authoritatively and the web client uses it for all game state.
- **`engine` (Rust)** is the fast implementation for computer players:
  simulations, search, tournaments, and future training. It runs natively and,
  compiled to WebAssembly, inside the web client's AI worker.

Tests keep the two identical (same rules, same random streams, same AI
decisions); see [Testing](#testing).

TypeScript packages import each other as source. The server and scripts run
directly on Node ≥ 22.18 (native type stripping, no build step); the web
client is bundled by Vite. The code therefore only uses *erasable* TypeScript
syntax (no `enum`, no parameter properties) and imports files with their `.ts`
extension.

## `@myomyw/core`

| File | Contents |
| --- | --- |
| `constants.ts` | `Side`, `Ball`, `RULES` (limits and timings) |
| `random.ts` | `randomBall(rng)` — the official ball distribution; `seededRng(seed)` (mulberry32) |
| `grid.ts` | Generic helpers on the 10 × 10 backing matrix (`shiftLine`, `transposeGrid`), shared by the engine and the client's animation layer |
| `board.ts` | `Board`: pure board state. `push = shift + applyEffect`; `viewFor(side)` gives an agent's perspective |
| `game.ts` | `Game`: the complete rules as a synchronous state machine (turns, push limit, flips, win/lose, timeout/forfeit) |
| `ai/` | `Agent` interface, `WeakAI`, `StrongAI` (search in `search.ts`), `createAgent` / `agentFromSpec`, `playMatch` (headless host) |
| `protocol.ts` | Client/server message types and helpers |
| `scripts/arena.ts` | AI-vs-AI tournaments in TypeScript (`npm run arena:ts`) |

`Game` has no notion of time. Hosts (the server, the web client, `playMatch`)
own the clock and call `push`, `endTurn`, `timeout` or `forfeit`.

`Board` stores balls in a fixed 10 × 10 matrix of which only `lCol × rCol` is
in play; cells outside keep stale balls, which never affect the game. This
mirrors the original implementation, so the equivalence test can compare the
two matrices cell for cell.

## `@myomyw/engine` (Rust)

The crate `myomyw-engine` in `packages/engine/`, dependency-free:

| File | Contents |
| --- | --- |
| `src/board.rs` | `Board` as bitboards (below) |
| `src/game.rs` | `Game`, `Action` (`Push(line)` / `Stop`), `Game::actions()` / `apply()` — the Markov game of [rules.md §9](rules.md#9-formal-model-a-two-player-zero-sum-markov-game) |
| `src/rng.rs` | `Rng`: mulberry32, bit-identical to `seededRng`; `Rng::ball()` = `randomBall` |
| `src/ai/` | `Agent` trait, `WeakAi`, `StrongAi`, `PoolSearch` — ports of the TypeScript agents |
| `src/arena.rs` | `play_match`, multi-threaded `tournament` |
| `src/ffi.rs` | C ABI exported by the WebAssembly module |
| `src/bin/arena.rs`, `src/bin/bench.rs` | `npm run arena`, `npm run bench` |
| `js/index.ts` | TypeScript bindings: `Engine.load`, `WasmAgent` (implements `Agent`), `WasmBoard` |
| `scripts/build-wasm.ts` | `npm run build:wasm` → `dist/myomyw_engine.wasm` |

**Representation.** A board is four 128-bit one-hot planes — Key, Add line,
Remove line, Flip — with bit `l·10 + r` for cell (l, r); a cell with no bit is
a common ball, and bits outside the board are always zero. A push on a line is
one mask, one shift and one merge per plane; a board is an 80-byte `Copy`
value and a whole `Game` state barely more, so search and simulation copy
positions freely. The static evaluation walks only the (sparse) Key plane.

**Performance** (desktop, one thread): about 1.1 million random playouts per
second (≈60 million actions/s), and Hard-vs-Hard tournaments ≈7× faster than
the TypeScript implementation. `tournament` spreads games over all cores with
results independent of the thread count.

**WebAssembly.** Built for `wasm32-unknown-unknown` without `wasm-bindgen`: the
module (≈38 KB, 15 KB gzipped) has no imports and exports a handful of
functions (`src/ffi.rs`). Objects are heap pointers owned by the caller; boards
are exchanged through a 102-byte I/O buffer (`[lCol, rCol, cells[100]]`).
`js/index.ts` wraps this in classes and frees forgotten objects with a
`FinalizationRegistry`.

## `@myomyw/server`

- `server.ts` — creates the HTTP server (serves `packages/web/dist` if built)
  and the WebSocket endpoint on the same port.
- `lobby.ts` — validates the `hello` message (protocol version, name), then
  pairs players first-come-first-served. The first player of a pair is Green.
- `room.ts` — one game. The room owns a `Game`; clients only send intents
  and the room broadcasts every resulting event, so clients cannot desync or
  cheat. It enforces the 20 s turn timer and the 5 s between-push limit.
- `client.ts` — typed wrapper around a socket.

Configuration is via environment variables (`PORT`, `HOST`, `MAX_ROOMS`,
`MOTD`, `STATIC_DIR`); see `config.ts`. The wire format is in
[protocol.md](protocol.md).

## `@myomyw/web`

React 19 + Vite, SVG rendering, [Motion](https://motion.dev) for animation.
No global state library: screens are plain React state (`App.tsx` holds the
current `Route`), settings live in `localStorage` (`settings.ts`), and a match
is an external store read with `useSyncExternalStore`.

```
src/
  match/        framework-agnostic match controllers (no React)
    types.ts        MatchSnapshot (what the UI renders) and MatchController (what it calls)
    display.ts      DisplayBoard: board + sprite ids, updated with the core primitives
    MatchBase.ts    snapshot store, timers, show{Shift,Effect,Turn,Result}
    LocalMatch.ts   offline games: seats are human / AI / idle
    TutorialMatch.ts
    OnlineMatch.ts  plays server events through a sequential animation queue
    timing.ts       animation pacing (the original's durations)
  ai/           computer players off the main thread
    agents.ts       AsyncAgent, workerAgent(spec), syncAgent(agent)
    worker.ts       Web Worker running WasmAgents (TypeScript agents as fallback)
    protocol.ts     worker messages
  components/   BoardView (SVG board), GameLayout (board + side panel), dialogs, ball glyphs
  screens/      Home, LocalGame, Online, Tutorial, Rules, Settings
  i18n/         en, zh-CN, zh-TW dictionaries (typed: every language has every key)
```

### Match controllers

A `MatchController` exposes `press(col)` / `release()` for human input and
publishes immutable `MatchSnapshot`s. The UI never touches game logic.

- **`LocalMatch`** owns a `Game` and paces it like the original:
  `press → push (300 ms animation) → if still held: cool down 400 ms → push again`,
  release ends the turn; an AI seat is asked `pushAgain` after every push
  instead. It uses exactly the agent protocol of `playMatch`, and a test
  asserts that, with the same seeds, both produce identical games.
- **`OnlineMatch`** sends intents to the server and replays the server's
  `pushed` / `turn` / `over` events one animation at a time. If events pile up
  (network jitter) the queue plays them faster until it has caught up.
- **`TutorialMatch`** is a `LocalMatch` with an idle opponent, a scripted ball
  sequence and steps that place special balls on the board.

### Computer players

AI seats hold an `AsyncAgent`: the `Agent` protocol with promise-returning
`firstPush` / `pushAgain`, so an agent may think for as long as it needs
without freezing the page. `workerAgent(spec)` creates the agent in one shared
Web Worker that loads the WebAssembly engine and runs `WasmAgent`s; if
WebAssembly cannot be loaded, the worker falls back to the TypeScript agents
(identical play, only slower). `LocalMatch` ignores answers that arrive after
the situation changed (timeout, match closed).

### Rendering

The board is an axis-aligned grid drawn rotated by 45°: `x` runs along
Green's lines, `y` along Blue's, ejectors sit at `x = −1` / `y = −1` and the
timer at `(−1, −1)` — the top corner. `Layout` in `BoardView.tsx` maps cells to
SVG coordinates for the current board size; every ball is a keyed element
that animates to its new position when the snapshot changes. This gives all
animations for free: pushes (balls slide one cell), flips (balls glide to their
mirrored cells), and resizes (the whole board rescales). Balls leaving the
board are rendered as short-lived "ghosts".

`DisplayBoard` applies each push in two steps (`shift`, then `applyEffect`
after the animation) with the same primitives as `Board`, so the displayed
position can never drift from the real one.

Input: pointer events on ejectors (press-and-hold, released anywhere), hover /
drag highlighting of the line, and keyboard (Tab to an ejector, hold Space or
Enter).

## Testing

`npm test` builds the WebAssembly module, then runs Vitest over all TypeScript
packages and `cargo test`:

- `core/test/rules.test.ts` — the rules.
- `core/test/equivalence.test.ts` — the TypeScript rules engine matches the
  original JavaScript (`core/test/legacy/GameNode.js`) cell for cell.
- `core/test/ai.test.ts` — alpha-beta soundness against plain negamax, and
  behaviour checks for the AIs.
- `engine/test/engine.test.ts` — the WebAssembly engine against the TypeScript
  engine: identical pushes over random sequences, and identical AI decisions
  in full games for the same seeds.
- `server/test/server.test.ts` — a real server with two WebSocket clients.
- `web/test/localMatch.test.ts` — the offline match controller on fake
  timers (hold-to-repeat, 5-push limit, timeout, identical games to `playMatch`).
- Rust unit tests (`packages/engine/src/**`) — the bitboard board against a
  plain array model, the RNG against reference values from TypeScript, turn
  logic, alpha-beta soundness, and thread-count-independent tournaments.

As an end-to-end check, the native arena (`npm run arena`) and the TypeScript
arena (`npm run arena:ts`) print identical results for the same arguments.

`npm run typecheck` type-checks all TypeScript packages; `cargo clippy` and
`cargo fmt` apply to the Rust crate.
