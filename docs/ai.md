# Computer players

The game ships three computer opponents, derived from the original (Beta 0.8)
AIs with their bugs fixed (see [History](#history)).

| Difficulty | Class | Source |
| --- | --- | --- |
| Easy | `WeakAI` | [`packages/core/src/ai/weak.ts`](../packages/core/src/ai/weak.ts) |
| Normal | `StrongAI(maxDepth = 1, fillout = 10)` | [`packages/core/src/ai/strong.ts`](../packages/core/src/ai/strong.ts) |
| Hard | `StrongAI(maxDepth = 2, fillout = 10)` | same, search in [`search.ts`](../packages/core/src/ai/search.ts) |

Presets are created with `createAgent(difficulty, rng?)`, or from a string
spec with `agentFromSpec` (`easy`, `normal`, `hard`, `strong:<depth>,<fillout>`).

## Implementations

Each agent exists twice, with identical behaviour:

| | TypeScript (`@myomyw/core`) | Rust (`@myomyw/engine`) |
| --- | --- | --- |
| Agents | `WeakAI`, `StrongAI`, `PoolSearch` | `WeakAi`, `StrongAi`, `PoolSearch` |
| Create | `agentFromSpec(spec, seededRng(seed))` | `agent_from_spec(spec, seed)`; in JS `engine.createAgent(spec, seed)` |
| Runs in | Node, the browser main thread | natively (fast, multi-threaded) and as WebAssembly |

Both use the same random generator (mulberry32), so an agent created with the
same seed makes the same decisions in either language; the test suite checks
this over full games. The web client runs the WebAssembly agents in a Web
Worker (see [architecture.md](architecture.md#computer-players)).

## The agent interface

```ts
interface Agent {
  readonly name: string;
  beginTurn(view: Board): void;   // start of each of the agent's turns
  firstPush(next: Ball): number;  // which of its lines to push
  pushAgain(next: Ball): boolean; // push the same line again, or end the turn?
}
```

- An agent always plays **as Left**. The host passes
  `game.board.viewFor(side)`, which is a copy of the board flipped if the agent
  is Right (the colour symmetry of [rules.md §9.6](rules.md#96-properties)).
  Line numbers are the same in both views, so the returned column is used on
  the real board unchanged.
- `next` is the ball the push will insert. After `firstPush`, the host keeps
  calling `pushAgain(game.next)` while the turn can continue (no Flip fell
  off, fewer than 5 pushes, game not over). `true` means the host pushes again
  with that same `next`.
- Agents may keep a private copy of the board and apply their own pushes to it,
  so the host must play exactly what they return, inserting exactly the
  `next` it passed.

[`playMatch(left, right, options)`](../packages/core/src/ai/match.ts) is the
reference host (headless, no timers). The web client's `LocalMatch` follows the
same protocol; a test checks that both produce identical games.

## Easy — `WeakAI`

A one-shot heuristic with no search.

1. For each of its lines `l`, compute a score, walking the line from the
   ejector (`r = 0`) to the exit (`r = rCol − 1`), where each ball is weighted
   by `(r + 1) / rCol` (balls closer to falling off matter more):

   | Ball | Value |
   | --- | --- |
   | Common | +1 |
   | Key | −3, or −10 if it is the very next ball to fall off |
   | Add line | −1 |
   | Remove line | +2 |
   | Flip | +1 if the opponent has more lines than the agent, else −1 |

2. Pick the line with the highest score (the first one on ties).
3. Push it `round(bestScore)` times, clamped to 1…5, stopping early if a Flip
   falls off. It does not look at the next ball at all, and may push a Key off
   while executing its plan — it is meant to be easy.

## Normal / Hard — `StrongAI`

A negamax search with alpha-beta pruning over **sampled futures**: the
unknown upcoming balls are replaced by random sequences, and values are
averaged over `fillout` samples (plain Monte Carlo averaging: samples are
drawn from the true ball distribution, so each counts equally).

### The search (`PoolSearch`)

For one fixed sequence of upcoming balls (the **pool**; `pool[0]` is the
real next ball, the rest random), `PoolSearch.search(node, depth, α, β, side)`
is a textbook negamax with alpha-beta pruning:

- A **move** is a whole turn: choose one of `side`'s lines, then push it
  1–5 times. `searchCol` pushes a line repeatedly; after each push it scores
  "stop here" as `−search(child, depth − 1, opponent)` and keeps the best.
  It stops pushing at a Key (value `LOSS = −10000` for the side that pushed it
  off), at a Flip (the turn is over) or at a beta cut-off.
- Every push, by either side, consumes the next pool entry. The pool is sized
  so that the search never runs out (reading past it throws).
- **Evaluation** at depth 0 (`evaluate`, from Left's point of view): for every
  line, count the balls that can be pushed off before a Key would fall off
  (walking back from the exit end); if the line contains no Key at all, the
  count is doubled. Left's lines add to the score, Right's subtract.

A test checks that the pruned search returns exactly the value of a plain
negamax without pruning.

### Choosing the line (`firstPush`)

For each of `fillout` samples, draw `maxDepth · 5 − 1` random balls after the
real next ball and add `searchCol(root, maxDepth, Left, line)` to each line's
total. The same sample is used for all lines (common random numbers). Push the
line with the highest total (first on ties).

### Deciding to continue (`pushAgain`)

Let `d = max(1, maxDepth − 1)` and `M = 5 − pushes so far`. For each of
`fillout` samples, score the plans

- *stop now*: `−search(root, d, Right)`;
- *push m more times*, `m = 1 … M`: push the line `m` times on a copy, then
  `−search(copy, d, Right)`. If the Key falls off at push `j`, plans with
  `m ≥ j` score `LOSS` in this sample; if a Flip falls off at push `j`, the
  turn ends there, so plans with `m ≥ j` score the same as plan `j`.

Push again if some plan with `m ≥ 1` has a strictly higher total than
stopping. Every plan is followed by the same opponent search depth `d`; using
at least one ply means Normal also sees the opponent's reply when deciding
whether to stop.

## Baseline strength

`npm run arena -- --a <agent> --b <agent> --games 1000 --seed 1`
(native, all cores; `npm run arena:ts` is the TypeScript version and prints
the same results). Agents alternate sides; Green moves first. With 1000 games
the 95% confidence interval of a win rate is about ±3 percentage points.

| A vs B | A wins | Avg. turns |
| --- | --- | --- |
| Hard vs Normal | 76.1% | 70 |
| Normal vs Easy | 92.1% | 53 |
| Hard vs Easy | 96.5% | 50 |
| Hard vs Hard | 49.3% | 77 |

In Hard vs Hard, the first mover won 49.1% of games: moving first is no
measurable advantage. Natively, Hard takes about 80 µs per turn and the
1000-game Hard-vs-Hard tournament about 1 s on 24 threads (6.6 s on one), so a
stronger agent has a large time budget to work with.

## Writing a new agent

Simulation-heavy agents belong in Rust:

1. Implement the `Agent` trait in `packages/engine/src/ai/`, seeded with a
   `u32` for reproducible tournaments. `Game` is a cheap `Copy` state with
   `actions()` / `apply(action, rng)` for simulations; `Board::evaluate`,
   `Board::hash64` and `PoolSearch` are available. `npm run bench` measures
   raw engine throughput.
2. Add a spec for it in `agent_from_spec` (`src/ai/mod.rs`) and measure it
   against `hard` with `npm run arena`.
3. To offer it in the app: expose it in `agent_new` (`src/ffi.rs`) and
   `parseSpec` (`js/index.ts`), then add a difficulty to the web client's
   screens and i18n dictionaries. It runs in the AI worker, so thinking time
   does not block the page; keep it within the 20 s turn limit.

The TypeScript agents remain the reference used by tests and the worker's
fallback when WebAssembly is unavailable. Porting a new agent to TypeScript is
optional; without a port, it simply is not available in that fallback.

## History

Beta 0.8 shipped `WeakAI` and `StrongAI` in JavaScript. The rewrite first
ported them exactly (verified move for move against the original code), then
fixed these bugs:

| # | Bug in the original | Fix |
| --- | --- | --- |
| 1 | `WeakAI` never scored Flip balls: the case label was misspelled (`Chessman.filp`). | Scored as intended: ±1. |
| 2 | The search generated Right's moves from *Left's* line count, skipping some of Right's lines or pushing nonexistent ones (reading hidden off-board cells). | Each side iterates its own lines. |
| 3 | `search` passed `maxMovements` (5) as `searchCol`'s "best value so far", which cut the search off after one push whenever β ≤ 5. | Standard cut-off on the column's own best value. |
| 4 | Samples drawn from the true distribution (7/11, 1/11) were additionally weighted by a mismatched probability (0.6 / 0.1 per ball). | Plain averaging. |
| 5 | `pushAgain` used `maxDepth` samples instead of `fillout`. | `fillout` samples. |
| 6 | "Stop now" was searched at depth 1 but "push more" at depth `maxDepth − 1`. | Same depth `max(1, maxDepth − 1)` for every plan. |
| 7 | When one sample hit a Key or Flip, the number of plans considered shrank for *all later samples*. | Handled per sample (see above). |
| 8 | Some `pushAgain` searches read past the filled part of the ball pool. | Pool sized correctly; overruns throw. |

Each fixed AI beats its original version (1000 games, alternating sides):
Easy 54.6%, Normal 66.0%, Hard 70.5%. For fix 6, making both plans use depth
`maxDepth − 1` (0 for Normal) instead was tried first; that Normal lost to the
original (46.7%), which is why the depth is at least 1.
