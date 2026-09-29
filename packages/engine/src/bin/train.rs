//! Trains the network on self-play data (see `selfplay`): the value head on
//! game results, and with `--policy <weight>` a policy head on the visit
//! distributions of the `.pol` files next to the data files, where present.
//!
//!   cargo run --release --bin train -- --data a.bin,b.bin --out net.bin --epochs 4

use std::path::Path;
use std::process::ExitCode;
use std::thread;
use std::time::Instant;

use myomyw_engine::Rng;
use myomyw_engine::ai::value::features::{SAMPLE_BYTES, Sample};
use myomyw_engine::ai::value::net::Net;
use myomyw_engine::ai::value::train::{Adam, Grad, PolicyTarget, random_net};

/// A training position and its policy target, if any.
type Item = (Sample, Option<PolicyTarget>);

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
    let mut policy = 0.0f32;
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
            "--policy" => policy = v.parse().unwrap(),
            "--seed" => seed = v.parse().unwrap(),
            "--threads" => threads = v.parse().unwrap(),
            _ => {
                eprintln!("unknown flag {flag}");
                return ExitCode::FAILURE;
            }
        }
    }
    // Hold out the last 5% of each file (whole games, roughly) for validation.
    let (mut train, mut valid): (Vec<Item>, Vec<Item>) = (Vec::new(), Vec::new());
    for path in &data {
        let bytes = std::fs::read(path).expect("cannot read data");
        let mut samples: Vec<Sample> = bytes.chunks_exact(SAMPLE_BYTES).map(|c| Sample::from_bytes(c).expect("bad sample")).collect();
        if lambda < 1.0 {
            td_lambda(&mut samples, lambda);
        }
        let policies: Vec<Option<PolicyTarget>> = match std::fs::read(Path::new(path).with_extension("pol")) {
            Ok(pol) => {
                assert_eq!(pol.len(), samples.len() * PolicyTarget::BYTES, "{path}: .pol file does not match");
                pol.chunks_exact(PolicyTarget::BYTES).map(PolicyTarget::decode).collect()
            }
            Err(_) => vec![None; samples.len()],
        };
        let items: Vec<Item> = samples.into_iter().zip(policies).collect();
        let cut = items.len() * 95 / 100;
        valid.extend_from_slice(&items[cut..]);
        train.extend_from_slice(&items[..cut]);
    }
    let with_policy = train.iter().filter(|x| x.1.is_some()).count();
    println!("{} training ({with_policy} with a policy target) and {} validation positions", train.len(), valid.len());
    // Training target: (1 − mix) · result + mix · search value.
    for (x, _) in train.iter_mut().chain(valid.iter_mut()) {
        x.target = (1.0 - mix) * x.target + mix * x.search;
    }
    let mut net = match &init {
        Some(p) => Net::from_bytes(&std::fs::read(p).unwrap()).unwrap(),
        None => random_net(h1, h2, policy > 0.0, seed),
    };
    if policy > 0.0 && !net.has_policy() {
        // Give an initial network a fresh policy head.
        let fresh = random_net(net.h1, net.h2, true, seed);
        (net.wp, net.bp) = (fresh.wp, fresh.bp);
    }
    let mut adam = Adam::new(&net, lr);
    adam.weight_decay = wd;
    let mut rng = Rng::new(seed);
    // Validation: value loss and mean squared error; policy cross-entropy and
    // how often the policy's favourite first push is the search's.
    let evaluate = |net: &Net, set: &[Item]| -> String {
        let chunk = set.len().div_ceil(threads).max(1);
        let parts: Vec<[f64; 6]> = thread::scope(|s| {
            set.chunks(chunk)
                .map(|part| {
                    s.spawn(move || {
                        let mut grad = Grad::zeros(net);
                        let mut acc = [0.0f64; 6];
                        for (x, pol) in part {
                            let f = x.features();
                            let target = (x.target + 1.0) * 0.5;
                            let value_loss = grad.accumulate(net, &f, target, None, 0.0);
                            acc[0] += f64::from(value_loss);
                            acc[1] += f64::from((net.value(&f) - x.target).powi(2));
                            if let (Some(t), true) = (pol, net.has_policy()) {
                                acc[2] += f64::from(grad.accumulate(net, &f, target, Some(t), 1.0) - value_loss);
                                acc[3] += 1.0;
                                if t.lines > 0 {
                                    let logits = net.forward(&f).policy;
                                    let best = |p: &[f32]| (0..t.lines).max_by(|&a, &b| p[a].total_cmp(&p[b])).unwrap();
                                    acc[4] += f64::from(u8::from(best(&logits) == best(&t.probs)));
                                    acc[5] += 1.0;
                                }
                            }
                        }
                        acc
                    })
                })
                .collect::<Vec<_>>()
                .into_iter()
                .map(|h| h.join().unwrap())
                .collect()
        });
        let sum = |i: usize| parts.iter().map(|p| p[i]).sum::<f64>();
        let n = set.len() as f64;
        let mut report = format!("valid loss {:.4}, mse {:.4}", sum(0) / n, sum(1) / n);
        if sum(3) > 0.0 {
            report += &format!(", policy CE {:.4}, top-1 {:.1}%", sum(2) / sum(3), 100.0 * sum(4) / sum(5).max(1.0));
        }
        report
    };
    println!("start: {}", evaluate(&net, &valid));
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
                            for (x, pol) in part {
                                loss += g.accumulate(net_ref, &x.features(), (x.target + 1.0) * 0.5, pol.as_ref(), policy);
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
        println!(
            "epoch {}: train loss {:.4}, {} ({:.1}s)",
            epoch + 1,
            total / train.len() as f64,
            evaluate(&net, &valid),
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
