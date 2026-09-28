//! Training of the value network (used by `bin/train.rs`): the logistic loss
//! gradient and the Adam optimiser.

use super::features::{Features, N_FEATURES};
use super::net::Net;

/// A randomly initialised network (He-style) from a seed.
pub fn random_net(h1: usize, h2: usize, seed: u32) -> Net {
    let mut rng = crate::rng::Rng::new(seed);
    let mut gauss = move |scale: f32| {
        // Sum of uniforms ≈ normal.
        let s: f64 = (0..12).map(|_| rng.next_f64()).sum::<f64>() - 6.0;
        s as f32 * scale
    };
    let s1 = (2.0 / 30.0f32).sqrt();
    let s2 = (2.0 / h1 as f32).sqrt();
    let s3 = (1.0 / h2 as f32).sqrt();
    Net {
        h1,
        h2,
        w1: (0..N_FEATURES * h1).map(|_| gauss(s1)).collect(),
        b1: vec![0.0; h1],
        w2: (0..h2 * h1).map(|_| gauss(s2)).collect(),
        b2: vec![0.0; h2],
        w3: (0..h2).map(|_| gauss(s3)).collect(),
        b3: 0.0,
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

    /// Adds the gradient of the logistic loss for one sample (`target` in [0, 1]); returns the loss.
    /// Only the rows of `w1` listed in `f` are touched.
    pub fn accumulate(&mut self, net: &Net, f: &Features, target: f32) -> f32 {
        let a = net.forward(f);
        let p = 1.0 / (1.0 + (-a.logit).exp());
        let loss = -(target * p.max(1e-7).ln() + (1.0 - target) * (1.0 - p).max(1e-7).ln());
        let d_logit = p - target;
        let g = &mut self.0;
        g.b3 += d_logit;
        let d_z2: Vec<f32> = a.z2.iter().zip(&net.w3).map(|(&z, &w)| if z > 0.0 { d_logit * w } else { 0.0 }).collect();
        g.w3.iter_mut().zip(&a.z2).for_each(|(gw, &z)| *gw += d_logit * z);
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
