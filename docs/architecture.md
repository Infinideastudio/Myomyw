# Architecture

Myomyw is a TypeScript monorepo (npm workspaces) with three packages:

```
packages/
  core/     @myomyw/core    rules engine, AI players, protocol types, arena  (no dependencies)
  server/   @myomyw/server  WebSocket game server + static hosting of the web client
  web/      @myomyw/web     React client (Vite)
docs/       rules, AI, protocol, this file
```

`core` is imported as TypeScript source by the other two packages. The server
and scripts run directly on Node ≥ 22.18 (native type stripping, no build
step); the web client is bundled by Vite. This is why the code only uses
*erasable* TypeScript syntax (no `enum`, no parameter properties) and imports
files with their `.ts` extension.

## `@myomyw/core`

| File | Contents |
| --- | --- |
| `constants.ts` | `Side`, `Ball`, `RULES` (limits and timings) |
| `random.ts` | `randomBall(rng)` — the official ball distribution; `seededRng(seed)` |
| `grid.ts` | Generic helpers on the 10 × 10 backing matrix (`shiftLine`, `transposeGrid`), shared by the engine and the client's animation layer |
| `board.ts` | `Board`: pure board state. `push = shift + applyEffect`; `viewFor(side)` gives an agent's perspective |
| `game.ts` | `Game`: the complete rules as a synchronous state machine (turns, push limit, flips, win/lose, timeout/forfeit) |
| `ai/` | `Agent` interface, `WeakAI`, `StrongAI`, `createAgent(difficulty)`, `playMatch` (headless host) |
| `protocol.ts` | Client/server message types and helpers |
| `scripts/arena.ts` | AI-vs-AI tournaments (`npm run arena`) |

`Game` has no notion of time. Hosts (the server, the web client, `playMatch`)
own the clock and call `push`, `endTurn`, `timeout` or `forfeit`.

`Board` stores balls in a fixed 10 × 10 matrix of which only `lCol × rCol` is
in play; cells outside keep stale balls. This mirrors the original
implementation exactly, because the original AI can observe those cells (see
[ai.md](ai.md)).

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

`npm test` runs Vitest over all packages:

- `core/test/rules.test.ts` — the rules.
- `core/test/equivalence.test.ts` — move-for-move equivalence of the rules
  engine and AIs with the original JavaScript (`core/test/legacy/`).
- `server/test/server.test.ts` — a real server with two WebSocket clients.
- `web/test/localMatch.test.ts` — the offline match controller on fake
  timers (hold-to-repeat, 5-push limit, timeout, identical games to `playMatch`).

`npm run typecheck` type-checks all packages.
