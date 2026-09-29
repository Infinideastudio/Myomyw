# Computer players

The game ships four computer opponents. Easy, Normal and Hard are the original
(Beta 0.8) AIs with their bugs fixed (see [History](#history)); Impossible is a
Monte Carlo tree search guided by a neural network trained by self-play (see
[Impossible](#impossible--mctsai) and [Research notes](#research-notes)). They
are implemented in the Rust engine (`packages/engine/src/ai/`) and run natively
or as WebAssembly; the web client runs them in a Web Worker (see
[architecture.md](architecture.md#computer-players)).

| Difficulty | Spec | Implementation |
| --- | --- | --- |
| Easy | `easy` | `WeakAi` — [`weak.rs`](../packages/engine/src/ai/weak.rs) |
| Normal | `normal` | `StrongAi::new(1, 10, seed)` — [`strong.rs`](../packages/engine/src/ai/strong.rs) |
| Hard | `hard` | `StrongAi::new(2, 10, seed)` — search in [`search.rs`](../packages/engine/src/ai/search.rs) |
| Impossible | `impossible` | `MctsAi` — [`mcts.rs`](../packages/engine/src/ai/mcts.rs), value network in [`value/`](../packages/engine/src/ai/value/) |

Agents are created from a spec (`easy`, `normal`, `hard`, `impossible` or
`strong:<maxDepth>,<fillout>`; natively also `mcts:<key>=<value>,…`, see
below) and a 32-bit seed: `agent_from_spec(spec, seed)` in Rust,
`engine.createAgent(spec, seed)` in TypeScript. The same spec and seed always
make the same decisions.

## The agent interface

```rust
pub trait Agent: Send {
    fn name(&self) -> String;
    fn begin_turn(&mut self, view: &Board);   // start of each of the agent's turns
    fn first_push(&mut self, next: Ball) -> usize; // which of its lines to push
    fn push_again(&mut self, next: Ball) -> bool;  // push the same line again, or end the turn?
}
```

(`WasmAgent` in TypeScript has the same methods: `beginTurn`, `firstPush`, `pushAgain`.)

- An agent always plays **as Left**. The host passes `game.view()`, the board
  flipped if the agent is Right (the colour symmetry of
  [rules.md §9.6](rules.md#96-properties)). Line numbers are the same in both
  views, so the returned line is used on the real board unchanged.
- `next` is the ball the push will insert. After `first_push`, the host keeps
  calling `push_again(game.next)` while the turn can continue (no Flip fell
  off, fewer than 5 pushes, game not over). `true` means the host pushes again
  with that same `next`.
- Agents may keep a private copy of the board and apply their own pushes to it,
  so the host must play exactly what they return, inserting exactly the
  `next` it passed.

[`play_match`](../packages/engine/src/arena.rs) is the reference host
(headless, no timers). The web client's `LocalMatch` follows the same protocol;
a test checks that both produce identical games.

## Easy — `WeakAi`

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

## Normal / Hard — `StrongAi`

A negamax search with alpha-beta pruning over **sampled futures**: the
unknown upcoming balls are replaced by random sequences, and values are
averaged over `fillout` samples (plain Monte Carlo averaging: samples are
drawn from the true ball distribution, so each counts equally).

### The search (`PoolSearch`)

For one fixed sequence of upcoming balls (the **pool**; `pool[0]` is the
real next ball, the rest random), `PoolSearch::search(node, depth, α, β, side)`
is a textbook negamax with alpha-beta pruning:

- A **move** is a whole turn: choose one of `side`'s lines, then push it
  1–5 times. `search_col` pushes a line repeatedly; after each push it scores
  "stop here" as `−search(child, depth − 1, opponent)` and keeps the best.
  It stops pushing at a Key (value `LOSS = −10000` for the side that pushed it
  off), at a Flip (the turn is over) or at a beta cut-off.
- Every push, by either side, consumes the next pool entry. The pool is sized
  so that the search never runs out.
- **Evaluation** at depth 0 (`Board::evaluate`, from Left's point of view): for every
  line, count the balls that can be pushed off before a Key would fall off
  (walking back from the exit end); if the line contains no Key at all, the
  count is doubled. Left's lines add to the score, Right's subtract.

A test checks that the pruned search returns exactly the value of a plain
negamax without pruning.

### Choosing the line (`first_push`)

For each of `fillout` samples, draw `maxDepth · 5 − 1` random balls after the
real next ball and add `search_col(root, maxDepth, Left, line)` to each line's
total. The same sample is used for all lines (common random numbers). Push the
line with the highest total (first on ties).

### Deciding to continue (`push_again`)

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

## Impossible — `MctsAi`

Monte Carlo tree search at the granularity of the formal model
([rules.md §9](rules.md#9-formal-model-a-two-player-zero-sum-markov-game)):
every push decision (which line; then push again or stop) is a move, and
after each push a chance node draws the next ball. It searches before every
decision, so unlike `StrongAi` it never sees future balls it could not know.

- **Tree.** Nodes are positions with the next ball known. Each action has one
  child per possible next ball (a Stop has one child). Descending, the ball is
  drawn from the true distribution, so averages converge to the expected
  value (expectimax).
- **Selection.** UCT on values in [−1, 1] from the chooser's point of view,
  exploration constant `c = 0.3`.
- **Prior.** The first time the search passes through a node, each of its
  actions gets 10 virtual visits worth the network's value of the position it
  leads to (assuming a common ball follows; pushing a Key off is an exact
  loss). This one-ply look-ahead focuses the search on plausible moves at
  once. It is computed lazily because most nodes are leaves that are never
  visited again, and its values are reused when the same positions are
  expanded (after a Stop, or a push followed by a common ball).
- **Leaves** are evaluated by the value network; there are no rollouts.
- **Budget.** 20 000 iterations per decision (`IMPOSSIBLE_ITERS`), so games are
  reproducible for a seed. The subtree of the position actually reached is
  kept for the next decision of the same turn.

The native spec `mcts:<key>=<value>,…` overrides these settings: `iters`,
`ms` (time budget per decision, not reproducible), `c`, `prior`, `net=<file>`
(another weight file), `eval=static` (`tanh(Board::evaluate / 10)` instead
of the network) and `puct=<constant>` (AlphaZero-style selection with the
network's policy head; see [Research notes](#research-notes)). `mcts` alone
equals `impossible`.

### The value network (`src/ai/value/`)

A multilayer perceptron estimating the probability that the player to move
wins: 509 sparse inputs → 64 ReLU → 32 ReLU → 1 logistic output, about 34 000
weights (136 KB, embedded in the engine from `value/weights.bin`). The inputs,
always from the mover's point of view (`features.rs`):

- every special ball, by kind and position counted from the **bottom corner**
  (how many pushes from falling off each side's lines), so features keep
  their meaning when lines are added or removed;
- both line counts, the next ball, the pushes made this turn, and the
  contents and position of the line being pushed;
- for each side, how many of its lines allow 0, 1, … pushes before a Key
  falls (and how many have no Key), and the classic `Board::evaluate`.

Only special balls are active inputs, so the first layer is a sum of a few
dozen rows; an evaluation takes about 0.7 µs natively (0.25 µs for the
features, 0.45 µs for the network). The WebAssembly build enables SIMD
(`.cargo/config.toml`), which makes the web AI about 1.8 times faster.

### Training

`packages/engine/scripts/train.sh FIRST LAST` runs self-play generations
(`bin/selfplay.rs` writes every decision position with the final result,
and the search's visit distribution to a `.pol` file beside it;
`bin/train.rs` trains with Adam on the logistic loss, plus with `--policy
<weight>` an optional policy head on the visit distributions). Generation *g* plays
20 000 games with the search above at 1600 iterations using network *g − 1*,
then trains network *g* from scratch on the positions of generations
*g − 2 … g* (about 15 million) for 5 epochs, holding out 5% for validation;
a generation takes about 45 minutes on 24 threads. The shipped network was
trained the same way (6 epochs) on all the positions of generations 2–7,
about 32 million (see [Research notes](#research-notes)).

## Baseline strength

`npm run arena -- --a <agent> --b <agent> --games 10000 --seed 1`
(native, all cores; results do not depend on the number of threads). Agents
alternate sides; Green moves first. With 10 000 games the 95% confidence
interval of a win rate is about ±1 percentage point (±3 with 1000 games —
enough for identical agents to land anywhere between 47% and 53%).

| A vs B | A wins | Avg. turns |
| --- | --- | --- |
| Hard vs Normal | 74.6% | 67 |
| Normal vs Easy | 91.6% | 51 |
| Hard vs Easy | 97.1% | 47 |
| Hard vs Hard | 49.9% | 72 |
| Impossible vs Hard\* | 97.3% | 59 |
| Impossible vs Normal\* | 98.4% | 50 |

\* 1000 games.

Over 30 000 Hard-vs-Hard games (seeds 1–3), the first mover won 50.5%: moving
first is no meaningful advantage. Hard takes about 75 µs per turn; the
10 000-game Hard-vs-Hard tournament takes about 9 s on 24 threads, so a
stronger agent has a large time budget to work with. Impossible takes about
30 ms per decision natively (80 ms per turn) and 40 ms per decision in
WebAssembly under Node (100 ms at worst).

These numbers use the current ball odds (6/10 common, 1/10 per special ball);
see [rules.md §3](rules.md#3-the-next-ball).

## Writing a new agent

1. Implement the `Agent` trait in `packages/engine/src/ai/`, seeded with a
   `u32` for reproducible tournaments. `Game` is a cheap `Copy` state with
   `actions()` / `apply(action, rng)` for simulations; `Board::evaluate`,
   `Board::hash64` and `PoolSearch` are available. `npm run bench` measures
   raw engine throughput.
2. Add a spec for it in `agent_from_spec` (`src/ai/mod.rs`) and measure it
   against `hard` (or `impossible`) with `npm run arena`.
3. To offer it in the app: expose it in `agent_new` (`src/ffi.rs`) and
   `parseSpec` (`js/index.ts`), then add a difficulty to the web client's
   screens and i18n dictionaries. It runs in the AI worker, so thinking time
   does not block the page; keep it within the 20 s turn limit.

## History

Beta 0.8 shipped `WeakAI` and `StrongAI` in JavaScript. The rewrite first
ported them exactly to TypeScript (verified move for move against the original
code), then fixed the bugs below, and finally ported the fixed agents to Rust
(verified decision for decision against the TypeScript versions, which were
then retired). Names in the table are those of the original code.

| # | Bug in the original | Fix |
| --- | --- | --- |
| 1 | `WeakAI` never scored Flip balls: the case label was misspelled (`Chessman.filp`). | Scored as intended: ±1. |
| 2 | The search generated Right's moves from *Left's* line count, skipping some of Right's lines or pushing nonexistent ones (reading hidden off-board cells). | Each side iterates its own lines. |
| 3 | `search` passed `maxMovements` (5) as `searchCol`'s "best value so far", which cut the search off after one push whenever β ≤ 5. | Standard cut-off on the column's own best value. |
| 4 | Samples drawn from the true distribution (then 7/11 and 1/11) were additionally weighted by a mismatched probability (0.6 / 0.1 per ball). | Plain averaging. |
| 5 | `continue` (push again?) used `maxDepth` samples instead of `fillout`. | `fillout` samples. |
| 6 | "Stop now" was searched at depth 1 but "push more" at depth `maxDepth − 1`. | Same depth `max(1, maxDepth − 1)` for every plan. |
| 7 | When one sample hit a Key or Flip, the number of plans considered shrank for *all later samples*. | Handled per sample (see above). |
| 8 | Some `continue` searches read past the filled part of the ball pool. | Pool sized correctly. |

Each fixed AI beats its original version (1000 games, alternating sides,
measured with the ball odds of the time, 7/11 and 1/11):
Easy 54.6%, Normal 66.0%, Hard 70.5%. For fix 6, making both plans use depth
`maxDepth − 1` (0 for Normal) instead was tried first; that Normal lost to the
original (46.7%), which is why the depth is at least 1.

## Research notes

How Impossible came about. Win rates are over 1000 games against Hard unless
noted (95% interval about ±3 points); "iterations" are per decision. Results
marked † used an earlier version of `mcts.rs` that also had random rollouts;
the rollout code was removed once network leaves made it unnecessary.

**Plain MCTS is weak.** With "safe" random rollouts to the end of the game
(random lines, never pushing a Key off voluntarily), 1000 iterations won only
8%† (400 games): random play is so unlike real play that its outcomes say
little about a position. Evaluating leaves with `tanh(Board::evaluate / 10)`
instead, after 0 or 4 random steps, gave 21.5%† / 39%† at 1000 iterations
(200 games), 67%† at 10 000 and 78.5%† at 50 000 (200 games): the search
works, the evaluation limits it.

**A learned value network.** Positions from self-play games, labelled with
the final result, train the network of [Training](#training). Generation 0
learned from 20 000 games of the static-evaluation search; each later
generation from games of the search using the previous network (2000
iterations, `c = 1`, no prior):

| Network | vs Hard |
| --- | --- |
| gen 0 | 44.0% |
| gen 1 | 60.0% |
| gen 2 | 68.8% |
| gen 3 | 71.8% |
| gen 4 | 68.5% (50.8% vs gen 3) |

The result labels are very noisy — the game is long and chancy, so the
validation loss only falls from 0.693 (a coin flip) to about 0.59 — but
millions of positions average the noise out. Things that did not help:
training on the search's own root values (the network just learns to copy
its predecessor: 44%, versus 60% for results on the same data; a 50/50 mix
gave 57%); TD(λ) returns over the search values (λ = 0.97: 67.3% versus
64.8% for results, within noise); wider networks (128 or 256 first-layer
units: same validation loss); averaging each new leaf over all five next
balls instead of the drawn one (+0.7 points for 2.5× the time).

**Search settings matter as much as the network.** With gen 3 at 2000
iterations, more search helps steadily (500: 54.3%, 2000: 71.8%, 10 000:
82.4%), and a smaller exploration constant is better than the textbook one
(`c` = 0.1 / 0.3 / 0.5 / 1 / 2: 66% / 73% / 76% / 72% / 60%). The largest
single gain was the **prior** (virtual visits valued by the network, see
above): at an equal 8 ms per decision it raised the win rate from 79.6% to
85.6%, and with `c = 0.3` and 10–30 virtual visits to about 91% at 2000
iterations.

**Better games, better networks.** Generations 5 and 6 were trained on games
of this stronger search (800 iterations): gen 5 beat gen 4 56.4% and gen 6
beat gen 5 52.2% (head to head, 2000 iterations each). Gen 6 was the first
network shipped (with 3000 iterations per decision).

**Second round: speed, then more search.** Head to head against that first
version, strength kept rising with the budget (1000 iterations: 34.8%,
10 000: 63.9%), so speed became the goal:

- Computing the prior lazily and reusing its values for the positions it
  evaluated made the search 4.8 times faster (35 → 7.4 ms per turn) with
  exactly the same decisions.
- WebAssembly SIMD made the web build about 1.8 times faster.
- Keeping the tree across turns did not help (50.1%): little of it
  survives the opponent's turn.

**More data beats more generations.** Generation 7 (self-play at 1600
iterations) beat gen 6 only 51.0%. Training on more positions helped more:
a network trained on generations 4–7 beat gen 7 55.0% (128 or 256
first-layer units: 54.3% and 55.9%, no better), and one trained on
generations 2–7 beat that 53.4%. Adding generations 0–1, played by the weak
static-evaluation search, did not help (51.3%). The generation 2–7 network
is shipped.

**The budget.** At 20 000 iterations the search beats 10 000 by 59.8%;
`c` is still best around 0.3 (0.2: 48.4%, 0.5: 51.4% against 0.3 at
10 000). Impossible now searches 20 000 iterations, about as long per
decision in the browser as the first version's 3000, and beats that version
73.0%.

**Third round: an AlphaZero policy head does not pay off.** The network can
carry a policy head on its second hidden layer: 10 logits for the first push
(one per line, counted from the bottom corner like the features) and one for
pushing again. It is trained with a cross-entropy loss on the search's root
visit distributions, and the search can then select with AlphaZero's PUCT
rule, Q + `puct` · P · √N / (1 + n), getting value and policy from the same
evaluation of each new node (`puct=…`, optionally with the one-ply prior
too). All comparisons below use the same network on both sides, 1000 games:

- Trained on 10 000 self-play games of the current search, the policy head
  picks the search's first push 41.7% of the time — exactly as often as the
  one-ply prior does (42.0%).
- At equal iterations (3000) PUCT alone is weaker than the current search
  (`puct` = 0.25 / 0.5 / 1 / 2 / 4: 44.8% / 46.4% / 42.2% / 36.3% / 32.8%);
  PUCT together with the one-ply prior is a little stronger (52.8–54.0%)
  but slower. At equal time (5 ms per decision) both tie (49.1%, 51.1%).
- One AlphaZero iteration (10 000 self-play games with PUCT, then
  retraining) made the policy agree more with its own search (47.8% versus
  42.1% for the one-ply prior), but not stronger: 46.3% at equal iterations,
  50.0% / 49.3% at 5 ms and 50.8% at 20 ms per decision.
- A larger network (128 and 64 hidden units) learns a better policy
  (48.5%), and there PUCT does beat the one-ply prior at equal time (52.7%
  over 3000 games) — but the larger network is slower, and the combination
  only ties the shipped AI (50.2% over 2000 games at 5 ms).

The one-ply prior is already a good policy: pushing the Key off is an exact
loss, and the value network judges the rest. The policy code is kept (off by
default) for future experiments.

Ideas not tried yet: features or targets that make the value network learn
faster than more data does — the value network, not the search, now limits
the AI.
