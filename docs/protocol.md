# Network protocol (version 3)

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
  | <-- welcome {motd, timeLimits} |   or: rejected {reason}, then close
  |          … waiting …           |
  | <-- matched {…} -------------- |
  | <-- turn {side, timeLimitMs} - |
  |   … pushes, turns, chat …      |
  | <-- over {winner, reason} ---- |   then the server closes the connection
```

One connection plays one game; to play again, reconnect.

## Client → server

| `t` | Fields | Meaning |
| --- | --- | --- |
| `hello` | `version: 3`, `name: string` (1–15 chars after trimming) | Join matchmaking. |
| `push` | `col: number` | Push one of your lines. Ignored unless it is your turn and the push is legal (same line as earlier pushes this turn, fewer than 5 pushes). |
| `endTurn` | — | End your turn (after at least one push). |
| `resign` | — | Give up; you lose. |
| `chat` | `text: string` (≤ 200 chars) | Relayed to the opponent while the game is running. |

## Server → client

| `t` | Fields | Meaning |
| --- | --- | --- |
| `welcome` | `motd: string`, `timeLimits: {turnMs, pushIntervalMs}` | Accepted; waiting for an opponent. `timeLimits` are the server's [timers](#timers). |
| `rejected` | `reason: "version" \| "full" \| "badName" \| "badMessage"` | Connection refused. |
| `matched` | `room`, `side` (yours), `opponent` (name), `board: {cells, lCol, rCol}`, `next`, `turn` | Game starts. |
| `turn` | `side`, `timeLimitMs: number \| null` | A turn starts; `side` must make its first push within `timeLimitMs` (`null`: no limit). |
| `pushed` | `side`, `col`, `inserted`, `ejected`, `next` | A push happened (sent to both players, including the pusher). Replaying it on a copy of the board (`WasmBoard.push(side, col, inserted)`) gives the new position; `ejected` is what fell off. |
| `over` | `winner`, `reason: "key" \| "timeout" \| "resign" \| "disconnect"` | Game over. |
| `chat` | `text` | Message from the opponent. |

After a `pushed` event the turn continues unless the server follows it with
`turn` (after a Flip or the 5th push) or `over` (after a Key). The server
ends a turn by itself in those cases; otherwise it waits for `endTurn`.

## Timers

Each server chooses its limits (environment variables `TURN_TIME_LIMIT` and
`PUSH_INTERVAL_LIMIT`, in seconds; `0` disables a limit) and announces them in
`welcome` as `timeLimits`, in milliseconds, with `null` for no limit:

- `turnMs` — first push of a turn, counted from the `turn` event (default
  20 000). Each `turn` event repeats it as `timeLimitMs`.
- `pushIntervalMs` — after each push, the next `push` or `endTurn` must arrive
  within this time (default 5 000).

Missing either limit loses the game (`reason: "timeout"`).
