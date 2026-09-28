# Myomyw — Rules

> **Myomyw** = **M**ake **y**our **o**pponent **m**ake **y**ou **w**in.

This document is the authoritative description of the rules. The reference
implementation is the engine: [`game.rs`](../packages/engine/src/game.rs) and
[`board.rs`](../packages/engine/src/board.rs); the test suite checks that it
behaves exactly like the original game (Beta 0.8).

## 1. Overview

Two players, **Green** and **Blue**, take turns pushing balls across a
diamond-shaped board. Whoever pushes the red **Key** ball off the board
**loses**. Every push also pushes some other ball off the far edge, and that
ball may change the board, so the game is about leaving your opponent only
losing moves.

## 2. The board

The board is a square grid turned 45° so that it stands on a corner.

A 3 × 3 board (the smallest possible):

```
            ⏱                 ⏱  timer (top corner)
         G1    B1             G1…G3  Green's ejectors, push ↘
      G2    ●     B2          B1…B3  Blue's ejectors,  push ↙
   G3    ●     ●     B3
      ●     ●     ●           Green line 1 = the ● cells going ↘ from G1
         ●     ●              Blue line 1  = the ● cells going ↙ from B1
            ●
```

- **Green** owns the ejectors along the **upper-left** edge; **Blue** owns those
  along the **upper-right** edge. Ejectors are numbered from the top corner
  outwards.
- Each ejector feeds one straight **line** of cells. Green's lines run from
  the upper-left edge down to the lower-right edge; Blue's lines run from the
  upper-right edge down to the lower-left edge. Every cell lies on exactly
  one Green line and one Blue line.
- If Green has *G* ejectors and Blue has *B*, the board has *G × B* cells, each
  Green line is *B* cells long and each Blue line is *G* cells long.
- Each side always has **between 3 and 10** ejectors.

**Starting position:** 6 ejectors per side (a 6 × 6 board), every cell holding
a common ball. **Green moves first.**

## 3. The next ball

There is always exactly one **next ball**, visible to both players. It is not
owned by either player: the next push, whoever makes it, inserts it. Right
after every push a new next ball is drawn at random, independently of
everything else:

| Ball | Probability |
| --- | --- |
| Common | 7/11 |
| Key | 1/11 |
| Add line | 1/11 |
| Remove line | 1/11 |
| Flip | 1/11 |

(Earlier documentation stated 6/10 and 1/10 each; the game has always used
elevenths.)

## 4. A push

To push, a player chooses **one of their own ejectors**. Then:

1. The next ball enters the first cell of that line (next to the ejector).
2. Every ball already in the line moves one cell further along it.
3. The ball that was in the last cell **falls off** the far edge.
4. The ball that fell off takes effect immediately (section 6).
5. A new next ball is drawn.

## 5. A turn

1. The player to move must push **at least once**.
2. They may keep pushing the **same line** (never another one), up to
   **5 pushes** in total per turn. In the app: press and hold an ejector to
   repeat; releasing it ends the turn.
3. The turn ends when the player stops, after the 5th push, or immediately
   when a **Flip** ball falls off. Then the other player moves.
4. The game ends immediately when a **Key** ball falls off.

Every push is resolved completely (including its effect) before the next one.
Effects of earlier pushes therefore apply to later pushes of the same turn —
for instance, after an Add-line ball falls off, the pusher's line is one cell
longer for their next push. The line being pushed can never disappear during
a turn, because Add/Remove-line balls only change the opponent's number of
lines and a Flip ends the turn.

## 6. Balls

Below, the **pusher** is the player whose push made the ball fall off, and the
**opponent** is the other player.

| Ball | Look | Effect when it falls off |
| --- | --- | --- |
| **Common** | black | None. |
| **Key** | red | The **pusher loses**. The game is over. |
| **Add line** | green, "+" | The opponent gains one ejector (unless they already have 10). |
| **Remove line** | yellow, "−" | The opponent loses one ejector (unless they have only 3). |
| **Flip** | blue, curved arrow | The board is mirrored and the pusher's turn ends at once. |

Details:

- **Add line.** The new ejector is added at the far end of the opponent's
  edge (it becomes their highest-numbered ejector). Its line is filled with
  common balls. Geometrically, the new cells sit at the far (exit) end of
  every one of the pusher's lines — they are the next balls the pusher would
  push off.
- **Remove line.** The opponent's highest-numbered ejector is removed together
  with its whole line of balls. These are the balls at the far (exit) end of
  every one of the pusher's lines. Removed balls, including Key balls, simply
  leave the game without effect.
- **Flip.** The board is mirrored left to right: the ball in Green line *i*,
  Blue line *j* moves to Green line *j*, Blue line *i*. The number of ejectors
  is swapped accordingly (Green now has as many as Blue had, and vice versa).
  Each player keeps their colour and their edge. The pusher's turn ends even
  if they have pushes left.

## 7. Timer

The top corner of the board is the **timer**.

- A player must make the **first push of their turn within 20 seconds** of the
  turn starting, or they **lose**. Once they have pushed, the timer stops for
  the rest of the turn.
- In offline games (against the computer or two players on one screen) the
  timer can be switched off in Settings.
- Online, the timer is always on, and one more limit applies: after each push
  the player must push again or end the turn **within 5 seconds**, otherwise
  they lose. (Holding an ejector repeats well within that limit; this only
  catches stalled connections.)

## 8. Other ways a game ends

- **Giving up** (online): the player who gives up loses.
- **Leaving** (online): a player who disconnects during a game loses.

There are no draws.

## 9. Formal model: a two-player zero-sum Markov game

Ignoring the real-time rules (timers, giving up, disconnecting), Myomyw is a
**turn-based, perfect-information, zero-sum stochastic game** (Markov game)
with terminal payoffs. The decision epoch is a single **push**, not a whole
turn: the next ball is revealed between the pushes of a turn, so a turn is a
sequence of decisions, each taken with knowledge of the ball it will insert.

### 9.1 Ingredients

- **Players:** $\mathcal{N} = \{\mathsf{L}, \mathsf{R}\}$ (Green, Blue). Write $-i$ for the opponent of $i$.
- **Balls:** $\mathcal{B} = \{\mathtt{C}, \mathtt{K}, \mathtt{A}, \mathtt{D}, \mathtt{F}\}$ (Common, Key, Add line, Remove line, Flip),
  drawn from $p(\mathtt{C}) = 7/11$ and $p(\mathtt{K}) = p(\mathtt{A}) = p(\mathtt{D}) = p(\mathtt{F}) = 1/11$.
- **Line counts:** $m, n \in \{3, \dots, 10\}$ = number of ejectors of $\mathsf{L}$ and $\mathsf{R}$.
- **Board:** $X \in \mathcal{B}^{m \times n}$; $X_{g,h}$ is the ball where Green line $g$
  meets Blue line $h$ (0-based; $g = 0$ and $h = 0$ are next to the top corner).

### 9.2 States

A non-terminal state is

$$s = (m,\ n,\ X,\ i,\ b,\ k,\ c)$$

| Component | Meaning |
| --- | --- |
| $m, n, X$ | the board |
| $i \in \mathcal{N}$ | player to move |
| $b \in \mathcal{B}$ | next ball (visible to both players) |
| $k \in \{0,\dots,4\}$ | pushes already made this turn |
| $c$ | line pushed this turn; $c = \bot$ iff $k = 0$ |

$k$ and $c$ are needed for the Markov property: they encode the 5-push limit
and the same-line constraint. There are two absorbing terminal states,
$\top_{\mathsf{L}}$ (Green has won) and $\top_{\mathsf{R}}$ (Blue has won).

**Initial distribution:** $s_0 = (6, 6, \mathtt{C}^{6\times 6}, \mathsf{L}, b_0, 0, \bot)$ with $b_0 \sim p$.

### 9.3 Actions

Only the player to move has a choice (the other player's action set is a
singleton), which makes the game **turn-based**:

$$
A_i(s) = \begin{cases}
\{\mathrm{push}(c') : 0 \le c' < \ell_i\} & k = 0 \\
\{\mathrm{push}(c),\ \mathrm{stop}\} & k \ge 1
\end{cases}
\qquad \ell_{\mathsf{L}} = m,\ \ell_{\mathsf{R}} = n.
$$

### 9.4 Transitions

**Stop.** Deterministically $s \to (m, n, X, -i, b, 0, \bot)$.

**Push.** $\mathrm{push}(c)$ is resolved in three steps.

1. *Shift.* Insert $b$ and push off the last ball $e$ of line $c$:
   - $i = \mathsf{L}$: $X'_{c,0} = b$, $X'_{c,h} = X_{c,h-1}$ for $1 \le h < n$, and $e = X_{c,n-1}$;
   - $i = \mathsf{R}$: $X'_{0,c} = b$, $X'_{g,c} = X_{g-1,c}$ for $1 \le g < m$, and $e = X_{m-1,c}$;
   - all other cells are unchanged.
2. *Effect* of $e$, producing $(m'', n'', X'')$:
   - $\mathtt{K}$: go to $\top_{-i}$ (the pusher loses); stop here.
   - $\mathtt{C}$: nothing changes.
   - $\mathtt{A}$: if $i = \mathsf{L}$ and $n < 10$, append a column $h = n$ of $\mathtt{C}$ and set $n'' = n+1$;
     if $i = \mathsf{R}$ and $m < 10$, append a row $g = m$ of $\mathtt{C}$ and set $m'' = m+1$; otherwise nothing.
   - $\mathtt{D}$: if $i = \mathsf{L}$ and $n > 3$, delete column $h = n-1$ and set $n'' = n-1$;
     if $i = \mathsf{R}$ and $m > 3$, delete row $g = m-1$ and set $m'' = m-1$; otherwise nothing.
   - $\mathtt{F}$: $X'' = X'^{\top}$, $(m'', n'') = (n, m)$.
3. *Chance and turn bookkeeping.* Draw $b' \sim p$. With $k' = k + 1$:

$$
s' = \begin{cases}
(m'', n'', X'', -i, b', 0, \bot) & e = \mathtt{F} \text{ or } k' = 5 \\
(m'', n'', X'', i, b', k', c) & \text{otherwise}
\end{cases}
$$

So $P(s' \mid s, a)$ is deterministic except for the factor $p(b')$.

### 9.5 Rewards and objective

$$
r_{\mathsf{L}}(s, a, s') = \begin{cases}
+1 & s' = \top_{\mathsf{L}} \text{ and } s \ne \top_{\mathsf{L}} \\
-1 & s' = \top_{\mathsf{R}} \text{ and } s \ne \top_{\mathsf{R}} \\
0 & \text{otherwise}
\end{cases}
\qquad r_{\mathsf{R}} = -r_{\mathsf{L}}.
$$

The payoff of a play is the undiscounted sum of rewards: $+1$ or $-1$ for the
winner and loser, and $0$ for both if the play never ends. Nothing in the rules
forces termination, but in practice every game ends (built-in AIs finish in
about 50–100 turns).

### 9.6 Properties

- **Zero-sum, perfect information.** Payoffs sum to zero, both players observe
  the full state, and chance only chooses the next ball.
- **Existence of optimal strategies.** The state and action spaces are finite
  and the game is turn-based. Treating $\top_{\mathsf{L}}$ / $\top_{\mathsf{R}}$ as absorbing
  states with per-step reward $\pm 1$, the payoff above equals the
  limiting-average payoff, so by Liggett & Lippman (1969) the game has a value
  $V(s)$ and both players have optimal **pure stationary** strategies (a push
  decision depending only on the current state).
- **Colour symmetry.** Let $\sigma$ swap the players and transpose the board:
  $\sigma(m,n,X,i,b,k,c) = (n,m,X^{\top},-i,b,k,c)$. Then
  $P(\sigma s' \mid \sigma s, a) = P(s' \mid s, a)$ and $V_{\mathsf{L}}(s) = V_{\mathsf{R}}(\sigma s)$, so
  one can always analyse the position from the mover's point of view as if they
  were Green. `Board.viewFor(side)` implements this canonicalisation; it is
  how every AI sees the board.
- **Size.** The state space is finite but astronomically large (up to
  $5^{100}$ boards alone), so exact solution is out of reach; the built-in
  AIs use depth-limited search over sampled ball sequences
  (see [ai.md](ai.md)).
- **Outside the model.** Timers, giving up and disconnecting are real-time
  rules layered on top. The implementation also keeps balls outside the
  visible $m \times n$ area in a hidden 10 × 10 matrix; they never influence the
  game (rows/columns that come back are reset to $\mathtt{C}$), so they are not
  part of the state.

## Appendix: correspondence with the code

| Rules term | Rust (`packages/engine/src`) | TypeScript (`@myomyw/engine`) |
| --- | --- | --- |
| Green / Blue | `Side::Left` / `Side::Right` | `Side.Left` / `Side.Right` |
| Number of Green / Blue ejectors | `board.l_col()` / `board.r_col()` | `board.lCol` / `board.rCol` |
| Ball in Green line *l*, Blue line *r* (0-based) | `board.get(l, r)` | `board.cells[l][r]` |
| Green pushes line *l* | inserts at (l, 0), pushes off (l, r_col − 1) | same |
| Blue pushes line *r* | inserts at (0, r), pushes off (l_col − 1, r) | same |
| Common / Key / Add line / Remove line / Flip | `Ball::Common` / `Key` / `AddCol` / `DelCol` / `Flip` | `Ball.Common` / … |
| State, action, transition (§9) | `Game`, `Action`, `Game::apply` | `WasmGame` |
| Next ball | `game.next` | `game.next` |
| 20 s / 5 s limits | — (real-time rules live in the hosts) | `RULES.turnTimeLimitMs` / `PUSH_INTERVAL_LIMIT_MS` (`@myomyw/protocol`) |
