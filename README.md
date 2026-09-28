# Myomyw

**Make your opponent make you win.**

Myomyw is a two-player pushing game. Players take turns pushing balls across a
diamond-shaped board; whoever pushes the red Key ball off the board loses. Every
push also changes what your opponent can do next — so the way to win is to
leave them nothing but losing moves.

Play against the computer (three difficulty levels), with a friend on the same
screen, or online. Available in English, 简体中文 and 正體中文.

## Rules in brief

- Green (moves first) owns the ejectors on the upper-left edge, Blue those on
  the upper-right edge. Each ejector pushes one line of balls across the board.
- On your turn, pick one of your lines and push it 1–5 times. Each push inserts
  the **next ball** (shown to both players) and pushes the last ball of the
  line off the far edge. Press and hold an ejector to keep pushing; release to
  end your turn.
- What falls off takes effect:
  - **Key** (red): the pusher loses.
  - **Add line** (green +): the opponent gains a line (at most 10).
  - **Remove line** (yellow −): the opponent loses a line (at least 3).
  - **Flip** (blue arrow): the board is mirrored and the pusher's turn ends.
- You have 20 seconds to make the first push of each turn.

The complete rules, including a formal model of the game as a zero-sum Markov
game, are in **[docs/rules.md](docs/rules.md)**.

## Getting started

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev          # web client with hot reload: http://localhost:5173
npm run dev:server   # game server for online play: ws://localhost:8650
```

Production:

```sh
npm run build        # builds the web client into packages/web/dist
npm start            # serves the client and the game server on http://localhost:8650
```

Server settings are environment variables: `PORT` (8650), `HOST`,
`MAX_ROOMS` (100), `MOTD`, `STATIC_DIR`. To host the client separately from the
server, build it with `VITE_SERVER_URL=wss://your-server` (players can also
set a custom server in Settings).

## Development

```sh
npm test             # all tests (rules, AI equivalence, server, match controller)
npm run typecheck    # type-check all packages
npm run arena -- --a hard --b normal --games 1000   # AI-vs-AI tournament
```

| Package | Contents |
| --- | --- |
| [`packages/core`](packages/core) | Rules engine, AI players, protocol types, arena script. No dependencies. |
| [`packages/server`](packages/server) | Authoritative WebSocket game server (Node + `ws`). |
| [`packages/web`](packages/web) | Web client (React, Vite, SVG + Motion). |

Documentation:

- [docs/rules.md](docs/rules.md) — the rules and their formal model
- [docs/ai.md](docs/ai.md) — how the computer players work
- [docs/architecture.md](docs/architecture.md) — code structure
- [docs/protocol.md](docs/protocol.md) — client/server protocol

## History

Versions up to Beta 0.8 were built with Cocos2d-x (JavaScript) and a Node.js
server; that code remains in the Git history (last commit `a38f32e`). This version is a
complete rewrite that keeps the game rules and the computer players' algorithms
exactly the same — the test suite checks this against the original source.
Native Android/Windows builds of the old client are not carried over; the new
client is a responsive web app that works on desktop and mobile browsers.

## License

[MIT](LICENSE)
