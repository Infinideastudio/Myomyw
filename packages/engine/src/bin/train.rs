//! Trains the value network on self-play data (see `selfplay`).
//!
//!   cargo run --release --bin train -- --data a.bin,b.bin --out net.bin --epochs 4

use std::process::ExitCode;
use std::thread;
use std::time::Instant;

use myomyw_engine::Rng;
use myomyw_engine::ai::value::features::{SAMPLE_BYTES, Sample};
use myomyw_engine::ai::value::net::Net;
use myomyw_engine::ai::value::train::{Adam, Grad, random_net};

fn main() -> ExitCode {
    let mut data: Vec<String> = Vec::new();
    let mut out = "net.bin".to_string();
    let mut init: Option<String> = None;
    let (mut h1, mut h2) = (64usize, 32usize);
    let mut epochs = 4usize;
    let mut lr = 1e-3f32;
    let mut batch = 1024usize;
    let mut wd = 0.0f32;
    let mut mix = 0.0f32;
    let mut lambda = 1.0f32;
    let mut seed = 1u32;
    let mut threads = thread::available_parallelism().map_or(1, |n| n.get());
    let mut args = std::env::args().skip(1);
    while let Some(flag) = args.next() {
        let Some(v) = args.next() else {
            eprintln!("missing value for {flag}");
            return ExitCode::FAILURE;
        };
        match flag.as_str() {
            "--data" => data.extend(v.split(',').map(String::from)),
            "--out" => out = v,
            "--init" => init = Some(v),
            "--h1" => h1 = v.parse().unwrap(),
            "--h2" => h2 = v.parse().unwrap(),
            "--epochs" => epochs = v.parse().unwrap(),
            "--lr" => lr = v.parse().unwrap(),
            "--batch" => batch = v.parse().unwrap(),
            "--wd" => wd = v.parse().unwrap(),
            "--mix" => mix = v.parse().unwrap(),
            "--lambda" => lambda = v.parse().unwrap(),
            "--seed" => seed = v.parse().unwrap(),
            "--threads" => threads = v.parse().unwrap(),
            _ => {
                eprintln!("unknown flag {flag}");
                return ExitCode::FAILURE;
            }
        }
    }
    // Hold out the last 5% of each file (whole games, roughly) for validation.
    let (mut train, mut valid) = (Vec::new(), Vec::new());
    for path in &data {
        let bytes = std::fs::read(path).expect("cannot read data");
        let mut samples: Vec<Sample> = bytes.chunks_exact(SAMPLE_BYTES).map(|c| Sample::from_bytes(c).expect("bad sample")).collect();
        if lambda < 1.0 {
            td_lambda(&mut samples, lambda);
        }
        let cut = samples.len() * 95 / 100;
        valid.extend_from_slice(&samples[cut..]);
        train.extend_from_slice(&samples[..cut]);
    }
    println!("{} training and {} validation positions", train.len(), valid.len());
    // Training target: (1 − mix) · result + mix · search value.
    for x in train.iter_mut().chain(valid.iter_mut()) {
        x.target = (1.0 - mix) * x.target + mix * x.search;
    }
    let mut net = match &init {
        Some(p) => Net::from_bytes(&std::fs::read(p).unwrap()).unwrap(),
        None => random_net(h1, h2, seed),
    };
    let mut adam = Adam::new(&net, lr);
    adam.weight_decay = wd;
    let mut rng = Rng::new(seed);
    let evaluate = |net: &Net, set: &[Sample]| -> (f64, f64) {
        let chunk = set.len().div_ceil(threads).max(1);
        let parts: Vec<(f64, f64)> = thread::scope(|s| {
            set.chunks(chunk)
                .map(|part| {
                    s.spawn(move || {
                        let mut grad = Grad::zeros(net);
                        let (mut loss, mut mse) = (0.0f64, 0.0f64);
                        for x in part {
                            let f = x.features();
                            let v = net.value(&f);
                            mse += f64::from((v - x.target).powi(2));
                            loss += f64::from(grad_loss(&mut grad, net, x));
                        }
                        (loss, mse)
                    })
                })
                .collect::<Vec<_>>()
                .into_iter()
                .map(|h| h.join().unwrap())
                .collect()
        });
        let n = set.len() as f64;
        (parts.iter().map(|p| p.0).sum::<f64>() / n, parts.iter().map(|p| p.1).sum::<f64>() / n)
    };
    let (l, m) = evaluate(&net, &valid);
    println!("start: valid loss {l:.4}, mse {m:.4}");
    for epoch in 0..epochs {
        let started = Instant::now();
        // Fisher–Yates shuffle.
        for i in (1..train.len()).rev() {
            let j = rng.below(i as u32 + 1) as usize;
            train.swap(i, j);
        }
        let mut total = 0.0f64;
        for batch_samples in train.chunks(batch) {
            let chunk = batch_samples.len().div_ceil(threads).max(1);
            let net_ref = &net;
            let grads: Vec<(Grad, f32)> = thread::scope(|s| {
                batch_samples
                    .chunks(chunk)
                    .map(|part| {
                        s.spawn(move || {
                            let mut g = Grad::zeros(net_ref);
                            let mut loss = 0.0;
                            for x in part {
                                loss += grad_loss(&mut g, net_ref, x);
                            }
                            (g, loss)
                        })
                    })
                    .collect::<Vec<_>>()
                    .into_iter()
                    .map(|h| h.join().unwrap())
                    .collect()
            });
            let mut iter = grads.into_iter();
            let (mut g, mut loss) = iter.next().unwrap();
            for (other, l) in iter {
                g.add(&other);
                loss += l;
            }
            g.scale(1.0 / batch_samples.len() as f32);
            total += f64::from(loss);
            adam.step(&mut net, &mut g);
        }
        let (l, m) = evaluate(&net, &valid);
        println!(
            "epoch {}: train loss {:.4}, valid loss {l:.4}, mse {m:.4} ({:.1}s)",
            epoch + 1,
            total / train.len() as f64,
            started.elapsed().as_secs_f64()
        );
        adam.lr *= 0.5;
        std::fs::write(&out, net.to_bytes()).unwrap();
    }
    ExitCode::SUCCESS
}

/// Replaces each result target by the TD(λ) return over the search values of
/// the following positions of the same game.
fn td_lambda(samples: &mut [Sample], lambda: f32) {
    assert!(samples.first().is_some_and(|s| s.start), "TD(λ) needs data with game boundaries");
    let sign = |s: &Sample| if s.mover == myomyw_engine::Side::Left { 1.0 } else { -1.0 };
    let mut end = samples.len();
    for i in (0..samples.len()).rev() {
        if !samples[i].start {
            continue;
        }
        // Game i..end, values in Left's point of view.
        let mut g = samples[end - 1].target * sign(&samples[end - 1]);
        for t in (i..end - 1).rev() {
            let next = samples[t + 1].search * sign(&samples[t + 1]);
            g = (1.0 - lambda) * next + lambda * g;
            samples[t].target = g * sign(&samples[t]);
        }
        end = i;
    }
}

fn grad_loss(g: &mut Grad, net: &Net, x: &Sample) -> f32 {
    g.accumulate(net, &x.features(), (x.target + 1.0) * 0.5)
}
