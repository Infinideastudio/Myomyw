//! "Impossible": Monte Carlo tree search over single pushes with explicit
//! chance nodes for the next ball (the Markov game of docs/rules.md §9),
//! guided by the learned value network of [`super::value`]. See docs/ai.md.

use std::sync::Arc;

use crate::ball::{Ball, Side};
use crate::board::Board;
use crate::game::{Action, Game};
use crate::rng::Rng;

use super::Agent;
use super::value::{Net, builtin_net, extract};

const NONE: u32 = u32::MAX;

/// How leaves are evaluated.
#[derive(Clone, Debug)]
pub enum Leaf {
    /// A value network (the built-in one unless another is loaded).
    Net(Arc<Net>),
    /// The classic static evaluation, `tanh(Board::evaluate / scale)`.
    Static { scale: f32 },
}

#[derive(Clone, Debug)]
pub struct MctsParams {
    /// Iterations per decision.
    pub iters: u32,
    /// Time budget per decision in milliseconds, replacing `iters` when non-zero (not reproducible).
    pub ms: u32,
    /// UCT exploration constant.
    pub c: f32,
    /// Virtual visits given to each action of a new node, valued by the leaf
    /// evaluation of its result (0: unvisited actions are simply tried in order).
    pub prior: f32,
    pub leaf: Leaf,
}

impl Default for MctsParams {
    /// The tuned settings of the Impossible AI.
    fn default() -> MctsParams {
        MctsParams { iters: IMPOSSIBLE_ITERS, ms: 0, c: 0.3, prior: 10.0, leaf: Leaf::Net(builtin_net()) }
    }
}

/// Iterations per decision of the Impossible AI.
pub const IMPOSSIBLE_ITERS: u32 = 20000;

impl MctsParams {
    /// Parses comma-separated `key=value` overrides of the defaults: `iters`,
    /// `ms`, `c`, `prior`, `net` (path of a weight file) and `eval=static`.
    pub fn parse(spec: &str) -> Result<MctsParams, String> {
        let mut p = MctsParams::default();
        for item in spec.split(',').filter(|s| !s.is_empty()) {
            let bad = || format!("bad MCTS option \"{item}\"");
            let (k, v) = item.split_once('=').ok_or_else(bad)?;
            match k {
                "iters" => p.iters = v.parse().map_err(|_| bad())?,
                "ms" => p.ms = v.parse().map_err(|_| bad())?,
                "c" => p.c = v.parse().map_err(|_| bad())?,
                "prior" => p.prior = v.parse().map_err(|_| bad())?,
                "net" => {
                    let bytes = std::fs::read(v).map_err(|e| format!("{v}: {e}"))?;
                    p.leaf = Leaf::Net(Arc::new(Net::from_bytes(&bytes)?));
                }
                "eval" if v == "static" => p.leaf = Leaf::Static { scale: 10.0 },
                _ => return Err(bad()),
            }
        }
        Ok(p)
    }
}

#[derive(Clone, Copy)]
struct Edge {
    action: Action,
    /// Visits, including the virtual ones of the prior.
    n: f32,
    /// Sum of values for the player who chose this edge.
    w: f32,
    /// Child per next ball (a Stop uses slot 0).
    child: [u32; 5],
    /// Value for Left of the position the prior evaluated (NaN before the prior is
    /// set); reused when the same position is expanded.
    prior_value: f32,
}

#[derive(Clone, Copy)]
struct Node {
    game: Game,
    first: u32,
    len: u32,
    n: u32,
    /// Whether the prior has been given to the actions (done on the first
    /// visit through the node, since most leaves are never visited again).
    primed: bool,
}

/// The search tree. Nodes are positions (after the next ball is drawn);
/// each action edge has one child per possible next ball.
pub struct Mcts {
    pub params: MctsParams,
    rng: Rng,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    path: Vec<(u32, Side)>,
    root: u32,
    value: f32,
}

/// Value of a finished game for Left.
fn terminal_value(game: &Game) -> f32 {
    match game.result {
        Some(r) if r.winner == Side::Left => 1.0,
        Some(_) => -1.0,
        None => 0.0,
    }
}

impl Mcts {
    pub fn new(params: MctsParams, seed: u32) -> Mcts {
        Mcts { params, rng: Rng::new(seed), nodes: Vec::new(), edges: Vec::new(), path: Vec::new(), root: 0, value: 0.0 }
    }

    /// Runs the search from `game` and returns the action with the most visits.
    /// Reuses the subtree of the previous search if `game` is one of its
    /// grandchildren (the position after the chosen action and the drawn ball).
    pub fn search(&mut self, game: &Game) -> Action {
        let root = match self.find_reusable(game) {
            Some(node) => node,
            None => {
                self.reset();
                self.add_node(*game)
            }
        };
        self.root = root;
        if self.nodes[root as usize].len > 1 {
            if self.params.ms > 0 {
                let started = std::time::Instant::now();
                let budget = std::time::Duration::from_millis(u64::from(self.params.ms));
                while started.elapsed() < budget {
                    for _ in 0..32 {
                        self.iterate(root);
                    }
                }
            } else {
                for _ in 0..self.params.iters {
                    self.iterate(root);
                }
            }
        }
        let node = self.nodes[root as usize];
        let edges = &self.edges[node.first as usize..(node.first + node.len) as usize];
        let mut best = 0;
        for (i, e) in edges.iter().enumerate() {
            if e.n > edges[best].n {
                best = i;
            }
        }
        self.value = if edges[best].n > 0.0 { edges[best].w / edges[best].n } else { 0.0 };
        edges[best].action
    }

    /// Value of the last search for the player to move (mean value of the chosen action).
    pub fn value(&self) -> f32 {
        self.value
    }

    /// Forgets the tree (the next search starts from scratch).
    pub fn reset(&mut self) {
        self.nodes.clear();
        self.edges.clear();
    }

    fn find_reusable(&self, game: &Game) -> Option<u32> {
        let root = self.nodes.get(self.root as usize)?;
        for e in &self.edges[root.first as usize..(root.first + root.len) as usize] {
            for &c in &e.child {
                if c != NONE && self.nodes[c as usize].game == *game {
                    return Some(c);
                }
            }
        }
        None
    }

    fn add_node(&mut self, game: Game) -> u32 {
        let first = self.edges.len() as u32;
        for &action in game.actions().iter() {
            self.edges.push(Edge { action, n: 0.0, w: 0.0, child: [NONE; 5], prior_value: f32::NAN });
        }
        let len = self.edges.len() as u32 - first;
        self.nodes.push(Node { game, first, len, n: 0, primed: self.params.prior <= 0.0 });
        self.nodes.len() as u32 - 1
    }

    /// Gives each action of `node` its prior: virtual visits valued by the
    /// evaluation of its result, assuming a common ball follows.
    fn prime(&mut self, node: u32) {
        let n = self.nodes[node as usize];
        let k = self.params.prior;
        for e in n.first..n.first + n.len {
            let mut g = n.game;
            match self.edges[e as usize].action {
                Action::Push(col) => {
                    g.push_then(col as usize, Ball::Common);
                }
                Action::Stop => g.end_turn(),
            }
            let v = self.evaluate(&g);
            let edge = &mut self.edges[e as usize];
            edge.n = k;
            edge.w = k * if n.game.turn == Side::Left { v } else { -v };
            edge.prior_value = v;
        }
        self.nodes[node as usize].primed = true;
    }

    fn iterate(&mut self, root: u32) {
        self.path.clear();
        let mut node = root;
        let value;
        loop {
            if self.nodes[node as usize].game.is_over() {
                value = terminal_value(&self.nodes[node as usize].game);
                break;
            }
            if !self.nodes[node as usize].primed {
                self.prime(node);
            }
            let n = self.nodes[node as usize];
            let e = self.select(&n);
            self.nodes[node as usize].n += 1;
            self.path.push((e, n.game.turn));
            let edge = self.edges[e as usize];
            let (slot, ball) = match edge.action {
                Action::Push(_) => {
                    let b = self.rng.ball();
                    (b as usize, b)
                }
                Action::Stop => (0, Ball::Common),
            };
            let child = edge.child[slot];
            if child == NONE {
                let mut g = n.game;
                match edge.action {
                    Action::Push(col) => {
                        g.push_then(col as usize, ball);
                    }
                    Action::Stop => g.end_turn(),
                }
                let c = self.add_node(g);
                self.edges[e as usize].child[slot] = c;
                // The prior evaluated exactly this position after a Stop, or after a push followed by a common ball.
                let known = edge.prior_value;
                value = if !known.is_nan() && (edge.action == Action::Stop || ball == Ball::Common) { known } else { self.evaluate(&g) };
                break;
            }
            node = child;
        }
        for &(e, side) in &self.path {
            let edge = &mut self.edges[e as usize];
            edge.n += 1.0;
            edge.w += if side == Side::Left { value } else { -value };
        }
    }

    fn select(&self, n: &Node) -> u32 {
        let log_n = ((n.n + 1) as f32).ln();
        let mut best = n.first;
        let mut best_score = f32::NEG_INFINITY;
        for e in n.first..n.first + n.len {
            let edge = &self.edges[e as usize];
            if edge.n == 0.0 {
                return e;
            }
            let score = edge.w / edge.n + self.params.c * (log_n / edge.n).sqrt();
            if score > best_score {
                best_score = score;
                best = e;
            }
        }
        best
    }

    /// Value of a position for Left: exact if the game is over, estimated otherwise.
    fn evaluate(&self, game: &Game) -> f32 {
        if game.is_over() {
            return terminal_value(game);
        }
        match &self.params.leaf {
            Leaf::Net(net) => {
                let v = net.value(&extract(game));
                if game.turn == Side::Left { v } else { -v }
            }
            Leaf::Static { scale } => (game.board.evaluate() as f32 / scale).tanh(),
        }
    }
}

/// The agent: searches before every push decision.
pub struct MctsAi {
    mcts: Mcts,
    game: Game,
    col: usize,
}

impl MctsAi {
    pub fn new(params: MctsParams, seed: u32) -> MctsAi {
        MctsAi { mcts: Mcts::new(params, seed), game: Game::from_position(Board::initial(), Side::Left, Ball::Common), col: 0 }
    }
}

impl Agent for MctsAi {
    fn name(&self) -> String {
        let p = &self.mcts.params;
        let leaf = match p.leaf {
            Leaf::Net(_) => "net",
            Leaf::Static { .. } => "static",
        };
        format!("MCTS(iters:{},ms:{},c:{},prior:{},eval:{leaf})", p.iters, p.ms, p.c, p.prior)
    }

    fn begin_turn(&mut self, view: &Board) {
        self.game = Game::from_position(*view, Side::Left, Ball::Common);
        self.mcts.reset();
    }

    fn first_push(&mut self, next: Ball) -> usize {
        self.game.next = next;
        let Action::Push(col) = self.mcts.search(&self.game) else { unreachable!("the first action of a turn is a push") };
        self.col = col as usize;
        self.col
    }

    fn push_again(&mut self, next: Ball) -> bool {
        self.game.push_then(self.col, next);
        self.mcts.search(&self.game) != Action::Stop
    }

    fn last_value(&self) -> Option<f32> {
        Some(self.mcts.value())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::arena::play_match;

    fn fast() -> MctsParams {
        MctsParams { iters: 200, ..MctsParams::default() }
    }

    #[test]
    fn stops_instead_of_pushing_a_key_off_the_board() {
        let mut board = Board::initial();
        for l in 0..6 {
            board.set(l, 4, Ball::Key);
        }
        let mut ai = MctsAi::new(fast(), 1);
        ai.begin_turn(&board);
        ai.first_push(Ball::Common);
        assert!(!ai.push_again(Ball::Common));
    }

    #[test]
    fn avoids_a_line_that_loses_at_once() {
        // Every line but 3 has a Key at its exit.
        let mut board = Board::initial();
        for l in [0, 1, 2, 4, 5] {
            board.set(l, 5, Ball::Key);
        }
        let mut ai = MctsAi::new(fast(), 2);
        ai.begin_turn(&board);
        assert_eq!(ai.first_push(Ball::Common), 3);
    }

    #[test]
    fn plays_complete_reproducible_games() {
        let play = |seed: u32| {
            let mut a = MctsAi::new(fast(), seed);
            let mut b = crate::ai::StrongAi::new(1, 10, seed + 100);
            play_match(&mut a, &mut b, &mut Rng::new(seed + 200), 10_000)
        };
        for seed in 1..=3 {
            let result = play(seed);
            assert!(result.winner.is_some());
            assert_eq!(result, play(seed));
        }
    }
}
