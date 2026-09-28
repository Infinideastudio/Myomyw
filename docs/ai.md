# Computer players

The game ships three computer opponents. They are **exact ports** of the
original JavaScript AIs from Beta 0.8, including several unintentional quirks,
which are part of their behaviour and are therefore kept (see
[Quirks](#quirks-preserved-on-purpose)).

| Difficulty | Class | Source |
| --- | --- | --- |
| Easy | `WeakAI` | [`packages/core/src/ai/weak.ts`](../packages/core/src/ai/weak.ts) |
| Normal | `StrongAI(maxDepth = 1, fillout = 10)` | [`packages/core/src/ai/strong.ts`](../packages/core/src/ai/strong.ts) |
| Hard | `StrongAI(maxDepth = 2, fillout = 10)` | same |

Presets are created with `createAgent(difficulty, rng?)`.

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
  is Right. Line numbers are the same in both views, so the returned column is
  used on the real board unchanged.
- `next` is the ball the push will insert. After `firstPush`, the host keeps
  calling `pushAgain(game.next)` while the turn can continue (no Flip fell
  off, fewer than 5 pushes, game not over). `true` means the host pushes again
  with that same `next`.
- Agents keep a private copy of the board and apply their own pushes to it,
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
   | Flip | 0 (see quirks) |

2. Pick the line with the highest score (the first one on ties; scores start
   at −100).
3. Push it `round(bestScore)` times, clamped to 1…5, stopping early if a Flip
   falls off. It does not look at the next ball at all.

## Normal / Hard — `StrongAI`

A negamax search with alpha-beta pruning over **sampled futures**: the unknown
future balls are replaced by random sequences, and results are averaged over
several samples weighted by the sample's probability.

**Move generation.** A "move" of the search is a whole turn: pick a line, then
push it 1–5 times. `searchCol` pushes one line repeatedly; after each push it
evaluates "stop here" by searching the opponent's reply one level deeper, and
keeps the best value. It stops pushing at a Key (value −10000 for the side that
pushed it off), at a Flip (the turn is over), or at a beta cut-off.

**Ball pool.** `pool[0]` is the real next ball, `pool[1…]` are random balls
drawn from the true distribution (7/11 common, 1/11 for each special). Every
push in the search consumes the next pool entry, whichever side makes it.

**Evaluation** (`evaluate`, from Left's point of view): for every line, count
the balls that can be pushed off before a Key would fall off (walking back
from the exit end); if the line contains no Key at all, the count is doubled.
Left's lines add to the score, Right's lines subtract from it.

**Choosing the line (`firstPush`).** For `fillout` samples:
fill `pool[1 … maxDepth·5 − 1]` with random balls and compute the sample weight
`w = ∏ (0.6 if common else 0.1)`. For every line `l`,
`value[l] += w · searchCol(root, maxDepth, −∞, +∞, Left, pool 0, l)`.
Push the line with the highest total value (first on ties).

**Deciding to continue (`pushAgain`).** Let `m_max = 5 − pushes so far`. For
`maxDepth` samples (sic, see quirks), with pool length
`(maxDepth − 1)·5 − 1 + m_max`:

- `value[0] −= w · search(root, depth 1, Right)` — stop now and let the
  opponent reply;
- for `m = 1 … m_max`: push the line once more on a scratch copy, then
  `value[m] −= w · search(copy, maxDepth − 1, Right)`. A Key falling off ends
  the loop with `m_max = m − 1`; a Flip ends it with `m_max = m`.

Push again if the best `value[m]` over `m = 0 … m_max` is at some `m ≥ 1`
(first on ties, so stopping wins ties).

## Quirks preserved on purpose

These are bugs in the original code. They change the AIs' decisions, so they
are part of "the same algorithm". Each is marked `QUIRK` in the source. Do not
fix them in `WeakAI`/`StrongAI`; build a new agent instead.

1. **WeakAI ignores Flip balls.** The original meant to score them
   (+1 if the opponent has more lines, else −1) but the `case` label was
   misspelled (`Chessman.filp`), so they always score 0.
2. **Right's move generation uses Left's line count.** `search` loops over
   `node.lCol` lines for both sides. When it is Right's move, Right therefore
   skips its lines beyond `lCol` if it has more, and pushes nonexistent lines
   if it has fewer. Pushing a nonexistent line moves "stale" balls in the
   hidden part of the 10 × 10 backing matrix (see `Board`), which is why
   `Board` keeps that matrix exactly as the original did.
3. **`bv` is always 5 inside the search.** `search` passes `maxMovements` (5)
   where `searchCol` expects the best value so far. `searchCol` stops pushing
   when `max(best, bv) ≥ beta`, so whenever `beta ≤ 5` it tries only a single
   push per line. (The root call passes −∞ and is unaffected.)
4. **Sample weights don't match the sampling distribution.** Samples are drawn
   with probabilities 7/11 and 1/11 but weighted with 0.6 and 0.1, and the
   weighting is applied on top of sampling (so likely sequences count twice).
5. **`pushAgain` uses `maxDepth` samples, not `fillout`.** Hard takes 2
   samples, Normal only 1.
6. **"Stop now" is always searched at depth 1**, while "push m more" is
   searched at depth `maxDepth − 1`. For Normal (`maxDepth = 1`), continuing is
   judged by the static evaluation but stopping by a 1-ply opponent search.
7. **Shrinking `m_max` leaks between samples.** When a sample hits a Key or
   Flip, the reduced `m_max` also limits all later samples.
8. **Reading past the pool.** In some `pushAgain` calls the depth-1 "stop now"
   search reads more pool entries than were filled. The original inserted
   `undefined`, which behaves exactly like a common ball in every code path;
   the port inserts a common ball.

## How equivalence is verified

[`packages/core/test/equivalence.test.ts`](../packages/core/test/equivalence.test.ts)
loads the untouched original sources (`packages/core/test/legacy/`) in a
sandbox whose `Math.random` is a seeded generator, gives the TypeScript agent
an identical generator, and plays complete games in lockstep: every
`firstPush` and `pushAgain` answer of the new agent must equal the original's.
It covers all pairings of Easy/Normal/Hard (~200 games) plus a crafted
position with stale Key balls outside the board. The legacy `GameNode` is also
compared with `Board` cell-for-cell over 60 000 random pushes, including
pushes on nonexistent lines. Deliberately re-introducing any quirk fix above
makes the test fail.

## Baseline strength

`npm run arena -- --a <agent> --b <agent> --games 1000 --seed 1`
(agents alternate sides; Left moves first):

| A vs B | A wins | Games | Avg. turns |
| --- | --- | --- | --- |
| Hard vs Normal | 67.6% | 1000 | 82 |
| Normal vs Easy | 86.3% | 1000 | 54 |
| Hard vs Easy | 93.1% | 1000 | 64 |
| Hard vs Hard | 50.2% | 1000 | 95 |

In Hard vs Hard, the first mover won 49.2% of games: moving first is no
measurable advantage. A decision by Hard takes well under a millisecond on a
desktop, so a stronger agent has a large time budget to work with.

## Writing a new agent

1. Implement `Agent` in `packages/core/src/ai/`, taking an `Rng` if it uses
   randomness (for reproducible tournaments).
2. Add it to `makeAgent` in [`packages/core/scripts/arena.ts`](../packages/core/scripts/arena.ts)
   and measure it against `hard`.
3. To offer it in the app, add a difficulty to `createAgent` and the i18n
   dictionaries. The web client calls agents on the main thread; an agent that
   thinks for more than a few milliseconds should be moved into a Web Worker.
