# Network protocol (version 4)

Clients connect to the game server over a WebSocket (by default the same host
and port that serves the web client). Every frame is a JSON object with a type
field `t`. Types are defined in
[`packages/protocol/index.ts`](../packages/protocol/index.ts).

The server is **authoritative**: it owns the game, draws the balls and runs
the timers. Clients send intents and render the events they receive; their
own pushes are only shown once echoed back by the server.

Ball ids: `0` Common, `1` Key, `2` Add line, `3` Remove line, `4` Flip.
Sides: `0` Green (Left, moves first), `1` Blue (Right).
Boards are `BoardSnapshot`s: `{ cells, lCol, rCol }` with `cells[l][r]` (see [rules.md](rules.md#appendix-correspondence-with-the-code)).

## Session

```
client                           server
  | -- hello {version, name} ----> |   within 10 s of connecting
  | <- welcome {motd, timeLimitMs} |   or: rejected {reason}, then close
  |          … waiting …           |
  | <-- matched {…} -------------- |
  | <-- turn {side} -------------- |
  |   … pushes, turns, chat …      |
  | <-- over {winner, reason} ---- |   then the server closes the connection
```

One connection plays one game; to play again, reconnect.

## Client → server

| `t` | Fields | Meaning |
| --- | --- | --- |
| `hello` | `version: 4`, `name: string` (1–15 chars after trimming) | Join matchmaking. |
| `push` | `col: number` | Push one of your lines. Ignored unless it is your turn and the push is legal (same line as earlier pushes this turn, fewer than 5 pushes). |
| `endTurn` | — | End your turn (after at least one push). |
| `resign` | — | Give up; you lose. |
| `chat` | `text: string` (≤ 200 chars) | Relayed to the opponent while the game is running. |

## Server → client

| `t` | Fields | Meaning |
| --- | --- | --- |
| `welcome` | `motd: string`, `timeLimitMs: number \| null` | Accepted; waiting for an opponent. `timeLimitMs` is the server's [time limit](#timers) per action. |
| `rejected` | `reason: "version" \| "full" \| "badName" \| "badMessage"` | Connection refused. |
| `matched` | `room`, `side` (yours), `opponent` (name), `board: {cells, lCol, rCol}`, `next`, `turn` | Game starts. |
| `turn` | `side` | A turn starts. |
| `pushed` | `side`, `col`, `inserted`, `ejected`, `next` | A push happened (sent to both players, including the pusher). Replaying it on a copy of the board (`WasmBoard.push(side, col, inserted)`) gives the new position; `ejected` is what fell off. |
| `over` | `winner`, `reason: "key" \| "timeout" \| "resign" \| "disconnect"` | Game over. |
| `chat` | `text` | Message from the opponent. |

After a `pushed` event the turn continues unless the server follows it with
`turn` (after a Flip or the 5th push) or `over` (after a Key). The server
ends a turn by itself in those cases; otherwise it waits for `endTurn`.

## Timers

Every action is timed separately. Each server chooses the time per action
(environment variable `TIME_LIMIT`, in seconds, default 20; `0` for no limit)
and announces it in `welcome` as `timeLimitMs`, in milliseconds, or `null`
for no limit. The player to move must send their next action within
`timeLimitMs` of:

- the `turn` event, for the first push of a turn;
- each `pushed` event that does not end the turn, for the next `push` or
  `endTurn`.

Running out of time loses the game (`reason: "timeout"`).
