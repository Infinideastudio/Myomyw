//! The value network: sparse features → ReLU → ReLU → win probability of the
//! player to move. Inference and the weight file format; training is in `train.rs`.

use super::features::{Features, N_FEATURES};

const MAGIC: &[u8; 4] = b"MYN1";
pub const MAX_H1: usize = 512;
pub const MAX_H2: usize = 128;

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
}

/// Intermediate values of a forward pass (used by training).
pub struct Activations {
    pub z1: Vec<f32>,
    pub z2: Vec<f32>,
    pub logit: f32,
}

impl Net {
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
        Activations { z1, z2, logit }
    }

    /// Value for the player to move, in [−1, 1]. Allocation-free.
    pub fn value(&self, f: &Features) -> f32 {
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
        let mut logit = self.b3;
        for j in 0..h2 {
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
            logit += self.w3[j] * a.max(0.0);
        }
        (logit * 0.5).tanh()
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = MAGIC.to_vec();
        for n in [N_FEATURES, self.h1, self.h2] {
            out.extend_from_slice(&(n as u32).to_le_bytes());
        }
        for part in [&self.w1, &self.b1, &self.w2, &self.b2, &self.w3] {
            part.iter().for_each(|x| out.extend_from_slice(&x.to_le_bytes()));
        }
        out.extend_from_slice(&self.b3.to_le_bytes());
        out
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Net, String> {
        if bytes.len() < 16 || &bytes[..4] != MAGIC {
            return Err("not a network file".into());
        }
        let word = |i: usize| u32::from_le_bytes(bytes[4 + 4 * i..8 + 4 * i].try_into().unwrap()) as usize;
        let (n_in, h1, h2) = (word(0), word(1), word(2));
        if n_in != N_FEATURES {
            return Err(format!("network has {n_in} inputs, expected {N_FEATURES}"));
        }
        let total = n_in * h1 + h1 + h2 * h1 + h2 + h2 + 1;
        if bytes.len() != 16 + 4 * total {
            return Err("network file has the wrong size".into());
        }
        let mut floats = bytes[16..].chunks(4).map(|c| f32::from_le_bytes(c.try_into().unwrap()));
        let mut take = |n: usize| (&mut floats).take(n).collect::<Vec<f32>>();
        let (w1, b1, w2, b2, w3) = (take(n_in * h1), take(h1), take(h2 * h1), take(h2), take(h2));
        Ok(Net { h1, h2, w1, b1, w2, b2, w3, b3: take(1)[0] })
    }

    pub(super) fn params(&self) -> [&[f32]; 6] {
        [&self.w1, &self.b1, &self.w2, &self.b2, &self.w3, std::slice::from_ref(&self.b3)]
    }

    /// All parameters as one flat vector view, in a fixed order (for the optimiser).
    pub(super) fn params_mut(&mut self) -> [&mut [f32]; 6] {
        [&mut self.w1, &mut self.b1, &mut self.w2, &mut self.b2, &mut self.w3, std::slice::from_mut(&mut self.b3)]
    }
}

#[cfg(test)]
mod tests {
    use super::super::features::extract;
    use super::super::train::{Grad, random_net};
    use super::*;
    use crate::game::Game;
    use crate::rng::Rng;

    #[test]
    fn value_matches_forward_and_serialisation_round_trips() {
        let net = random_net(40, 12, 3);
        let copy = Net::from_bytes(&net.to_bytes()).unwrap();
        let mut rng = Rng::new(4);
        let mut game = Game::new(&mut rng);
        for _ in 0..50 {
            if game.is_over() {
                game = Game::new(&mut rng);
            }
            let f = extract(&game);
            let v = net.value(&f);
            assert!((v - (net.forward(&f).logit * 0.5).tanh()).abs() < 1e-5);
            assert_eq!(v, copy.value(&f));
            game.apply(game.actions()[0], &mut rng);
        }
    }

    #[test]
    fn gradient_matches_finite_differences() {
        let mut net = random_net(16, 8, 5);
        let game = Game::new(&mut Rng::new(6));
        let f = extract(&game);
        let mut g = Grad::zeros(&net);
        g.accumulate(&net, &f, 0.8);
        let loss = |net: &Net| {
            let p = 1.0 / (1.0 + (-f64::from(net.forward(&f).logit)).exp());
            -(0.8 * p.ln() + 0.2 * (1.0 - p).ln())
        };
        for (i, analytic) in [(0usize, g.0.b1[0]), (3, g.0.b1[3])] {
            let h = 1e-2;
            net.b1[i] += h;
            let up = loss(&net);
            net.b1[i] -= 2.0 * h;
            let down = loss(&net);
            net.b1[i] += h;
            assert!(((up - down) / (2.0 * f64::from(h)) - f64::from(analytic)).abs() < 1e-2);
        }
        let numeric_b3 = {
            net.b3 += 1e-2;
            let up = loss(&net);
            net.b3 -= 2e-2;
            let down = loss(&net);
            net.b3 += 1e-2;
            (up - down) / 2e-2
        };
        assert!((numeric_b3 - f64::from(g.0.b3)).abs() < 1e-3);
    }
}
