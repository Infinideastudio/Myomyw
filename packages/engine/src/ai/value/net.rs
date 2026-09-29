//! The network: sparse features → ReLU → ReLU → win probability of the player
//! to move, and optionally a policy head on the same hidden layers. Inference
//! and the weight file format; training is in `train.rs`.

use super::features::{Features, N_FEATURES};

/// Weight files without (`MYN1`) and with (`MYN2`) a policy head.
const MAGIC_V1: &[u8; 4] = b"MYN1";
const MAGIC_V2: &[u8; 4] = b"MYN2";
pub const MAX_H1: usize = 512;
pub const MAX_H2: usize = 128;

/// Policy outputs: logits of the first push of a turn, one per line, indexed
/// from the bottom corner like the features (`slot = l_col − 1 − line`), and
/// the logit of pushing again (versus stopping) later in the turn.
pub const POLICY: usize = 11;
pub const PUSH_AGAIN: usize = 10;

/// The policy slot of line `line` when the mover has `l_col` lines.
#[inline]
pub const fn line_slot(l_col: usize, line: usize) -> usize {
    l_col - 1 - line
}

#[derive(Clone, Debug)]
pub struct Net {
    pub h1: usize,
    pub h2: usize,
    /// `N_FEATURES × h1`, one row per feature.
    pub w1: Vec<f32>,
    pub b1: Vec<f32>,
    /// `h2 × h1`, one row per second-layer unit.
    pub w2: Vec<f32>,
    pub b2: Vec<f32>,
    pub w3: Vec<f32>,
    pub b3: f32,
    /// Policy head, `POLICY × h2` (empty if the network has none).
    pub wp: Vec<f32>,
    pub bp: Vec<f32>,
}

/// Intermediate values of a forward pass (used by training).
pub struct Activations {
    pub z1: Vec<f32>,
    pub z2: Vec<f32>,
    pub logit: f32,
    /// Policy logits (empty without a policy head).
    pub policy: Vec<f32>,
}

impl Net {
    pub fn has_policy(&self) -> bool {
        !self.bp.is_empty()
    }

    pub fn forward(&self, f: &Features) -> Activations {
        let mut z1 = self.b1.clone();
        for k in 0..f.len {
            let row = &self.w1[f.idx[k] as usize * self.h1..][..self.h1];
            let v = f.val[k];
            for (z, w) in z1.iter_mut().zip(row) {
                *z += v * w;
            }
        }
        z1.iter_mut().for_each(|z| *z = z.max(0.0));
        let mut z2 = self.b2.clone();
        for (j, z) in z2.iter_mut().enumerate() {
            let row = &self.w2[j * self.h1..][..self.h1];
            *z += row.iter().zip(&z1).map(|(w, x)| w * x).sum::<f32>();
            *z = z.max(0.0);
        }
        let logit = self.b3 + self.w3.iter().zip(&z2).map(|(w, x)| w * x).sum::<f32>();
        let policy = (0..self.bp.len())
            .map(|o| self.bp[o] + self.wp[o * self.h2..][..self.h2].iter().zip(&z2).map(|(w, x)| w * x).sum::<f32>())
            .collect();
        Activations { z1, z2, logit, policy }
    }

    /// Second hidden layer (allocation-free).
    #[inline]
    fn hidden(&self, f: &Features, z2: &mut [f32; MAX_H2]) {
        let (h1, h2) = (self.h1, self.h2);
        assert!(h1 <= MAX_H1 && h2 <= MAX_H2);
        let mut z1 = [0.0f32; MAX_H1];
        let z1 = &mut z1[..h1];
        z1.copy_from_slice(&self.b1);
        for k in 0..f.len {
            let row = &self.w1[f.idx[k] as usize * h1..][..h1];
            let v = f.val[k];
            for (z, w) in z1.iter_mut().zip(row) {
                *z += v * w;
            }
        }
        z1.iter_mut().for_each(|z| *z = z.max(0.0));
        for (j, out) in z2.iter_mut().enumerate().take(h2) {
            let row = &self.w2[j * h1..][..h1];
            let mut acc = [0.0f32; 8];
            for (w, x) in row.chunks_exact(8).zip(z1.chunks_exact(8)) {
                for i in 0..8 {
                    acc[i] += w[i] * x[i];
                }
            }
            let mut a = self.b2[j] + acc.iter().sum::<f32>();
            for i in h1 / 8 * 8..h1 {
                a += row[i] * z1[i];
            }
            *out = a.max(0.0);
        }
    }

    /// Value for the player to move, in [−1, 1].
    pub fn value(&self, f: &Features) -> f32 {
        let mut z2 = [0.0f32; MAX_H2];
        self.hidden(f, &mut z2);
        let logit = self.b3 + self.w3.iter().zip(&z2).map(|(w, x)| w * x).sum::<f32>();
        (logit * 0.5).tanh()
    }

    /// Value for the player to move and policy logits (zero without a policy head).
    pub fn evaluate(&self, f: &Features) -> (f32, [f32; POLICY]) {
        let mut z2 = [0.0f32; MAX_H2];
        self.hidden(f, &mut z2);
        let z2 = &z2[..self.h2];
        let logit = self.b3 + self.w3.iter().zip(z2).map(|(w, x)| w * x).sum::<f32>();
        let mut policy = [0.0f32; POLICY];
        for (o, p) in policy.iter_mut().enumerate().take(self.bp.len()) {
            *p = self.bp[o] + self.wp[o * self.h2..][..self.h2].iter().zip(z2).map(|(w, x)| w * x).sum::<f32>();
        }
        ((logit * 0.5).tanh(), policy)
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = MAGIC_V2.to_vec();
        for n in [N_FEATURES, self.h1, self.h2, self.bp.len()] {
            out.extend_from_slice(&(n as u32).to_le_bytes());
        }
        for part in [&self.w1, &self.b1, &self.w2, &self.b2, &self.w3] {
            part.iter().for_each(|x| out.extend_from_slice(&x.to_le_bytes()));
        }
        out.extend_from_slice(&self.b3.to_le_bytes());
        for part in [&self.wp, &self.bp] {
            part.iter().for_each(|x| out.extend_from_slice(&x.to_le_bytes()));
        }
        out
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Net, String> {
        let words = match bytes.get(..4) {
            Some(m) if m == MAGIC_V1 => 3,
            Some(m) if m == MAGIC_V2 => 4,
            _ => return Err("not a network file".into()),
        };
        let header = 4 + 4 * words;
        if bytes.len() < header {
            return Err("network file is truncated".into());
        }
        let word = |i: usize| u32::from_le_bytes(bytes[4 + 4 * i..8 + 4 * i].try_into().unwrap()) as usize;
        let (n_in, h1, h2) = (word(0), word(1), word(2));
        let p = if words == 4 { word(3) } else { 0 };
        if n_in != N_FEATURES {
            return Err(format!("network has {n_in} inputs, expected {N_FEATURES}"));
        }
        if p != 0 && p != POLICY {
            return Err(format!("network has {p} policy outputs, expected {POLICY}"));
        }
        let total = n_in * h1 + h1 + h2 * h1 + h2 + h2 + 1 + p * h2 + p;
        if bytes.len() != header + 4 * total {
            return Err("network file has the wrong size".into());
        }
        let mut floats = bytes[header..].chunks(4).map(|c| f32::from_le_bytes(c.try_into().unwrap()));
        let mut take = |n: usize| (&mut floats).take(n).collect::<Vec<f32>>();
        let (w1, b1, w2, b2, w3) = (take(n_in * h1), take(h1), take(h2 * h1), take(h2), take(h2));
        let b3 = take(1)[0];
        let (wp, bp) = (take(p * h2), take(p));
        Ok(Net { h1, h2, w1, b1, w2, b2, w3, b3, wp, bp })
    }

    pub(super) fn params(&self) -> [&[f32]; 8] {
        [&self.w1, &self.b1, &self.w2, &self.b2, &self.w3, std::slice::from_ref(&self.b3), &self.wp, &self.bp]
    }

    /// All parameters, in a fixed order (for the optimiser).
    pub(super) fn params_mut(&mut self) -> [&mut [f32]; 8] {
        [
            &mut self.w1,
            &mut self.b1,
            &mut self.w2,
            &mut self.b2,
            &mut self.w3,
            std::slice::from_mut(&mut self.b3),
            &mut self.wp,
            &mut self.bp,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::super::features::extract;
    use super::super::train::{Grad, PolicyTarget, random_net};
    use super::*;
    use crate::game::Game;
    use crate::rng::Rng;

    #[test]
    fn inference_matches_forward_and_serialisation_round_trips() {
        for policy in [false, true] {
            let net = random_net(40, 12, policy, 3);
            let copy = Net::from_bytes(&net.to_bytes()).unwrap();
            let mut rng = Rng::new(4);
            let mut game = Game::new(&mut rng);
            for _ in 0..50 {
                if game.is_over() {
                    game = Game::new(&mut rng);
                }
                let f = extract(&game);
                let a = net.forward(&f);
                let v = net.value(&f);
                assert!((v - (a.logit * 0.5).tanh()).abs() < 1e-5);
                assert_eq!(v, copy.value(&f));
                let (v2, logits) = net.evaluate(&f);
                assert_eq!(v, v2);
                for (o, &x) in a.policy.iter().enumerate() {
                    assert!((x - logits[o]).abs() < 1e-4);
                }
                assert_eq!(copy.evaluate(&f), (v2, logits));
                game.apply(game.actions()[0], &mut rng);
            }
        }
    }

    #[test]
    fn gradient_matches_finite_differences() {
        let mut net = random_net(16, 8, true, 5);
        let game = Game::new(&mut Rng::new(6));
        let f = extract(&game);
        // A first push with 6 lines: a distribution over slots 0–5.
        let target = PolicyTarget::first_push(6, &[0.1, 0.2, 0.3, 0.0, 0.25, 0.15]);
        let mut g = Grad::zeros(&net);
        g.accumulate(&net, &f, 0.8, Some(&target), 0.5);
        let loss = |net: &Net| {
            let a = net.forward(&f);
            let p = 1.0 / (1.0 + (-f64::from(a.logit)).exp());
            let value = -(0.8 * p.ln() + 0.2 * (1.0 - p).ln());
            let logits: Vec<f64> = a.policy[..6].iter().map(|&x| f64::from(x)).collect();
            let max = logits.iter().cloned().fold(f64::MIN, f64::max);
            let log_z = max + logits.iter().map(|x| (x - max).exp()).sum::<f64>().ln();
            let ce: f64 = (0..6).map(|i| -f64::from(target.probs[i]) * (logits[i] - log_z)).sum();
            value + 0.5 * ce
        };
        let check = |net: &mut Net, get: &dyn Fn(&mut Net) -> &mut f32, analytic: f32| {
            let h = 1e-2;
            *get(net) += h;
            let up = loss(net);
            *get(net) -= 2.0 * h;
            let down = loss(net);
            *get(net) += h;
            let numeric = (up - down) / (2.0 * f64::from(h));
            assert!((numeric - f64::from(analytic)).abs() < 1e-2, "numeric {numeric}, analytic {analytic}");
        };
        check(&mut net, &|n| &mut n.b1[0], g.0.b1[0]);
        check(&mut net, &|n| &mut n.b1[3], g.0.b1[3]);
        check(&mut net, &|n| &mut n.b3, g.0.b3);
        check(&mut net, &|n| &mut n.bp[2], g.0.bp[2]);
        check(&mut net, &|n| &mut n.wp[4 * 8 + 1], g.0.wp[4 * 8 + 1]);
        check(&mut net, &|n| &mut n.b2[1], g.0.b2[1]);
    }
}
