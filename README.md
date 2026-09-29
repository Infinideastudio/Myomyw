# Myomyw

**Make your opponent make you win.**

Myomyw is a two-player pushing game. Players take turns pushing balls across a
diamond-shaped board; whoever pushes the red Key ball off the board loses. Every
push also changes what your opponent can do next — so the way to win is to
leave them nothing but losing moves.

Play against the computer (four difficulty levels), with a friend on the same
screen, or online. Available in English, 简体中文 and 正體中文.

## Rules in brief

- Green (moves first) owns the ejectors on the upper-left edge, Blue those on
  the upper-right edge. Each ejector pushes one line of balls across the board.
- On your turn, pick one of your lines and push it 1–5 times. Each push inserts
  the **next ball** (shown to both players) and pushes the last ball of the
  line off the far edge. Press and hold an ejector to keep pushing; release to
  end your turn.
- After every push a new next ball is drawn: common with probability 6/10,
  each of the four special balls below with probability 1/10.
- What falls off takes effect:
  - **Key** (red): the pusher loses.
  - **Add line** (green +): the opponent gains a line (at most 10).
  - **Remove line** (yellow −): the opponent loses a line (at least 3).
  - **Flip** (blue arrow): the board is mirrored and the pusher's turn ends.
- You have 20 seconds to make the first push of each turn.

The complete rules, including a formal model of the game as a zero-sum Markov
game, are in **[docs/rules.md](docs/rules.md)**.

## Getting started

Requires Node.js 22.18 or newer and a Rust toolchain (1.85+) with the
WebAssembly target — the game engine is written in Rust:

```sh
rustup target add wasm32-unknown-unknown
npm install
npm run dev          # web client with hot reload: http://localhost:5173
npm run dev:server   # game server for online play: ws://localhost:8650
```

Production:

```sh
npm run build        # builds the AI engine (WebAssembly) and the web client into packages/web/dist
npm start            # serves the client and the game server on http://localhost:8650
```

Server settings are environment variables: `PORT` (8650), `HOST`,
`MAX_ROOMS` (100), `MOTD`, `STATIC_DIR`, `TURN_TIME_LIMIT` (20 seconds for the
first push of a turn) and `PUSH_INTERVAL_LIMIT` (5 seconds between pushes);
`0` disables a time limit.

### GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) lints, tests and
builds on every push and pull request, and deploys the web client to GitHub
Pages from every run, whatever the branch (enable it once under *Settings →
Pages → Source: GitHub Actions*, and allow the branches in the `github-pages`
environment's deployment rules). The Pages site is static — offline modes only by default. To offer
online play there, run the server elsewhere and set the repository variable
`MYOMYW_SERVER_URL` (e.g. `wss://example.com`); players can also enter a
server in Settings.

To build such a standalone site yourself:
`VITE_STANDALONE=true [VITE_SERVER_URL=wss://…] npm run build`, then serve
`packages/web/dist` from any static host (relative paths, any sub-path).

## Development

```sh
npm test             # all TypeScript and Rust tests (builds the WebAssembly module first)
npm run typecheck    # type-check all TypeScript packages
npm run arena -- --a hard --b normal --games 1000   # AI-vs-AI tournament (native, all cores)
npm run bench        # engine throughput
```

| Package | Contents |
| --- | --- |
| [`packages/engine`](packages/engine) | Rules and AI players in Rust (bitboards), native and WebAssembly, with TypeScript bindings. |
| [`packages/protocol`](packages/protocol) | Client/server message types. |
| [`packages/server`](packages/server) | Authoritative WebSocket game server (Node + `ws`). |
| [`packages/web`](packages/web) | Web client (React, Vite, SVG + Motion). |

Documentation:

- [docs/rules.md](docs/rules.md) — the rules and their formal model
- [docs/ai.md](docs/ai.md) — how the computer players work
- [docs/architecture.md](docs/architecture.md) — code structure
- [docs/protocol.md](docs/protocol.md) — client/server protocol

## History

Versions up to Beta 0.8 were built with Cocos2d-x (JavaScript) and a Node.js
server; that code remains in the Git history (last commit `a38f32e`). This
version is a complete rewrite. Pushes and ball effects work exactly as before —
the test suite checks this against the original source — and the only rule
change is the ball odds: 6/10 common and 1/10 per special ball (previously 7/11
and 1/11). The computer players use the original algorithms with several bugs
fixed, which made each of them stronger (see [docs/ai.md](docs/ai.md#history)).
Native Android/Windows builds of the old client are not carried over; the new
client is a responsive web app that works on desktop and mobile browsers.

## License

[MIT](LICENSE)
