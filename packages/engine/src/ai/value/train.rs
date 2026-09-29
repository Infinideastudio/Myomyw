//! Training of the network (used by `bin/train.rs`): the loss gradients and
//! the Adam optimiser.

use super::features::{Features, N_FEATURES};
use super::net::{Net, POLICY, PUSH_AGAIN, line_slot};
use crate::game::{Action, Game};

/// A randomly initialised network (He-style) from a seed, with or without a policy head.
pub fn random_net(h1: usize, h2: usize, policy: bool, seed: u32) -> Net {
    let mut rng = crate::rng::Rng::new(seed);
    let mut gauss = move |scale: f32| {
        // Sum of uniforms ≈ normal.
        let s: f64 = (0..12).map(|_| rng.next_f64()).sum::<f64>() - 6.0;
        s as f32 * scale
    };
    let s1 = (2.0 / 30.0f32).sqrt();
    let s2 = (2.0 / h1 as f32).sqrt();
    let s3 = (1.0 / h2 as f32).sqrt();
    let p = if policy { POLICY } else { 0 };
    Net {
        h1,
        h2,
        w1: (0..N_FEATURES * h1).map(|_| gauss(s1)).collect(),
        b1: vec![0.0; h1],
        w2: (0..h2 * h1).map(|_| gauss(s2)).collect(),
        b2: vec![0.0; h2],
        w3: (0..h2).map(|_| gauss(s3)).collect(),
        b3: 0.0,
        wp: (0..p * h2).map(|_| gauss(s3)).collect(),
        bp: vec![0.0; p],
    }
}

/// A policy training target: the search's visit distribution.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PolicyTarget {
    /// First push: probability of each slot `0..lines`; later pushes: `probs[PUSH_AGAIN]`
    /// is the probability of pushing again.
    pub probs: [f32; POLICY],
    /// Number of lines for a first push, 0 for a push-again decision.
    pub lines: usize,
}

impl PolicyTarget {
    pub fn first_push(lines: usize, probs: &[f32]) -> PolicyTarget {
        let mut p = [0.0; POLICY];
        p[..lines].copy_from_slice(&probs[..lines]);
        PolicyTarget { probs: p, lines }
    }

    pub fn push_again(p: f32) -> PolicyTarget {
        let mut probs = [0.0; POLICY];
        probs[PUSH_AGAIN] = p;
        PolicyTarget { probs, lines: 0 }
    }

    /// The visit distribution of a search from `game` (see `Mcts::root_visits`);
    /// `None` if nothing was searched.
    pub fn from_visits(game: &Game, visits: &[(Action, f32)]) -> Option<PolicyTarget> {
        let total: f32 = visits.iter().map(|v| v.1).sum();
        if total <= 0.0 {
            return None;
        }
        match game.column {
            None => {
                let lines = game.board.ejectors(game.turn);
                let mut probs = [0.0; POLICY];
                for &(action, n) in visits {
                    if let Action::Push(line) = action {
                        probs[line_slot(lines, line as usize)] = n / total;
                    }
                }
                Some(PolicyTarget { probs, lines })
            }
            Some(_) => {
                let push: f32 = visits.iter().filter(|v| matches!(v.0, Action::Push(_))).map(|v| v.1).sum();
                Some(PolicyTarget::push_again(push / total))
            }
        }
    }

    /// Size of an encoded target in a `.pol` file (one per sample of the `.bin` file).
    pub const BYTES: usize = 12;

    /// Encodes an optional target: a kind byte (0 = none, 1–10 = first push with
    /// that many lines, 255 = push again) and the probabilities as bytes.
    pub fn encode(target: Option<&PolicyTarget>) -> [u8; Self::BYTES] {
        let mut out = [0u8; Self::BYTES];
        if let Some(t) = target {
            out[0] = if t.lines > 0 { t.lines as u8 } else { 255 };
            for (o, &p) in out[1..].iter_mut().zip(&t.probs) {
                *o = (p.clamp(0.0, 1.0) * 255.0).round() as u8;
            }
        }
        out
    }

    pub fn decode(bytes: &[u8]) -> Option<PolicyTarget> {
        let lines = match bytes[0] {
            0 => return None,
            255 => 0,
            n => n as usize,
        };
        let mut probs = [0.0; POLICY];
        for (p, &b) in probs.iter_mut().zip(&bytes[1..]) {
            *p = f32::from(b) / 255.0;
        }
        if lines > 0 {
            let sum: f32 = probs[..lines].iter().sum();
            probs[..lines].iter_mut().for_each(|p| *p /= sum.max(1e-6));
        }
        Some(PolicyTarget { probs, lines })
    }
}

/// Gradients with the shape of a `Net`.
pub struct Grad(pub Net);

impl Grad {
    pub fn zeros(net: &Net) -> Grad {
        let mut g = net.clone();
        g.params_mut().into_iter().for_each(|p| p.fill(0.0));
        Grad(g)
    }

    /// Adds the gradient for one sample of the logistic value loss (`target` in
    /// [0, 1]) plus `weight` × the policy cross-entropy, if there is a policy
    /// target; returns the loss. Only the rows of `w1` listed in `f` are touched.
    pub fn accumulate(&mut self, net: &Net, f: &Features, target: f32, policy: Option<&PolicyTarget>, weight: f32) -> f32 {
        let a = net.forward(f);
        let p = 1.0 / (1.0 + (-a.logit).exp());
        let mut loss = -(target * p.max(1e-7).ln() + (1.0 - target) * (1.0 - p).max(1e-7).ln());
        let d_logit = p - target;
        let g = &mut self.0;
        g.b3 += d_logit;
        g.w3.iter_mut().zip(&a.z2).for_each(|(gw, &z)| *gw += d_logit * z);
        let mut d_z2: Vec<f32> = net.w3.iter().map(|&w| d_logit * w).collect();
        if let (Some(t), true) = (policy, net.has_policy()) {
            // Gradient of the cross-entropy with respect to the logits.
            let mut d_policy = [0.0f32; POLICY];
            if t.lines > 0 {
                let logits = &a.policy[..t.lines];
                let max = logits.iter().cloned().fold(f32::MIN, f32::max);
                let z: f32 = logits.iter().map(|x| (x - max).exp()).sum();
                for i in 0..t.lines {
                    let q = (logits[i] - max).exp() / z;
                    loss -= weight * t.probs[i] * q.max(1e-7).ln();
                    d_policy[i] = weight * (q - t.probs[i]);
                }
            } else {
                let q = 1.0 / (1.0 + (-a.policy[PUSH_AGAIN]).exp());
                let tp = t.probs[PUSH_AGAIN];
                loss -= weight * (tp * q.max(1e-7).ln() + (1.0 - tp) * (1.0 - q).max(1e-7).ln());
                d_policy[PUSH_AGAIN] = weight * (q - tp);
            }
            for (o, &d) in d_policy.iter().enumerate() {
                if d == 0.0 {
                    continue;
                }
                g.bp[o] += d;
                let row = &net.wp[o * net.h2..][..net.h2];
                let grow = &mut g.wp[o * net.h2..][..net.h2];
                for ((gw, &w), (&z, dz)) in grow.iter_mut().zip(row).zip(a.z2.iter().zip(d_z2.iter_mut())) {
                    *gw += d * z;
                    *dz += d * w;
                }
            }
        }
        d_z2.iter_mut().zip(&a.z2).for_each(|(d, &z)| {
            if z <= 0.0 {
                *d = 0.0;
            }
        });
        let mut d_z1 = vec![0.0; net.h1];
        for (j, &d) in d_z2.iter().enumerate() {
            if d == 0.0 {
                continue;
            }
            g.b2[j] += d;
            let row = &net.w2[j * net.h1..][..net.h1];
            let grow = &mut g.w2[j * net.h1..][..net.h1];
            for (((gw, &w), &z), dz) in grow.iter_mut().zip(row).zip(&a.z1).zip(d_z1.iter_mut()) {
                *gw += d * z;
                *dz += d * w;
            }
        }
        for ((dz, &z), gb) in d_z1.iter_mut().zip(&a.z1).zip(g.b1.iter_mut()) {
            if z <= 0.0 {
                *dz = 0.0;
            }
            *gb += *dz;
        }
        for k in 0..f.len {
            let v = f.val[k];
            let grow = &mut g.w1[f.idx[k] as usize * net.h1..][..net.h1];
            grow.iter_mut().zip(&d_z1).for_each(|(gw, &dz)| *gw += v * dz);
        }
        loss
    }

    pub fn scale(&mut self, k: f32) {
        self.0.params_mut().into_iter().for_each(|p| p.iter_mut().for_each(|x| *x *= k));
    }

    pub fn add(&mut self, other: &Grad) {
        for (a, b) in self.0.params_mut().into_iter().zip(other.0.params()) {
            a.iter_mut().zip(b.iter()).for_each(|(x, y)| *x += y);
        }
    }
}

/// The Adam optimiser.
pub struct Adam {
    m: Net,
    v: Net,
    t: i32,
    pub lr: f32,
    pub weight_decay: f32,
}

impl Adam {
    pub fn new(net: &Net, lr: f32) -> Adam {
        Adam { m: Grad::zeros(net).0, v: Grad::zeros(net).0, t: 0, lr, weight_decay: 0.0 }
    }

    /// One step with gradient `g` (already averaged over the batch).
    pub fn step(&mut self, net: &mut Net, g: &mut Grad) {
        self.t += 1;
        let (b1, b2, eps) = (0.9f32, 0.999f32, 1e-8f32);
        let c1 = 1.0 - b1.powi(self.t);
        let c2 = 1.0 - b2.powi(self.t);
        let (lr, wd) = (self.lr, self.weight_decay);
        let params = net.params_mut();
        let grads = g.0.params_mut();
        let ms = self.m.params_mut();
        let vs = self.v.params_mut();
        for (((p, g), m), v) in params.into_iter().zip(grads).zip(ms).zip(vs) {
            for i in 0..p.len() {
                let gi = g[i] + wd * p[i];
                m[i] = b1 * m[i] + (1.0 - b1) * gi;
                v[i] = b2 * v[i] + (1.0 - b2) * gi * gi;
                p[i] -= lr * (m[i] / c1) / ((v[i] / c2).sqrt() + eps);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ball::{Ball, Side};
    use crate::board::Board;

    #[test]
    fn policy_targets_come_from_visits_and_round_trip() {
        // First push with 6 lines: line 5 is slot 0, line 0 is slot 5.
        let game = Game::from_position(Board::initial(), Side::Left, Ball::Common);
        let visits = [
            (Action::Push(0), 30.0),
            (Action::Push(1), 0.0),
            (Action::Push(2), 10.0),
            (Action::Push(3), 0.0),
            (Action::Push(4), 0.0),
            (Action::Push(5), 60.0),
        ];
        let t = PolicyTarget::from_visits(&game, &visits).unwrap();
        assert_eq!(t.lines, 6);
        assert!((t.probs[0] - 0.6).abs() < 1e-6 && (t.probs[5] - 0.3).abs() < 1e-6 && (t.probs[3] - 0.1).abs() < 1e-6);
        let back = PolicyTarget::decode(&PolicyTarget::encode(Some(&t))).unwrap();
        assert_eq!(back.lines, 6);
        assert!(back.probs.iter().zip(&t.probs).all(|(a, b)| (a - b).abs() < 0.01));
        // Push again or stop.
        let mut game = game;
        game.push_then(2, Ball::Common);
        let t = PolicyTarget::from_visits(&game, &[(Action::Push(2), 3.0), (Action::Stop, 1.0)]).unwrap();
        assert_eq!((t.lines, t.probs[PUSH_AGAIN]), (0, 0.75));
        let back = PolicyTarget::decode(&PolicyTarget::encode(Some(&t))).unwrap();
        assert!((back.probs[PUSH_AGAIN] - 0.75).abs() < 0.01 && back.lines == 0);
        // Nothing searched.
        assert_eq!(PolicyTarget::from_visits(&game, &[(Action::Push(2), 0.0), (Action::Stop, 0.0)]), None);
        assert_eq!(PolicyTarget::decode(&PolicyTarget::encode(None)), None);
    }
}
