//! Generates training data: plays games between two MCTS agents and writes
//! every decision position (from the mover's point of view) with the final
//! result to `OUT`, and the search's visit distribution to `OUT` with the
//! extension `.pol` (one entry per position).
//!
//!   cargo run --release --bin selfplay -- --a mcts:iters=1600 --games 1000 --out data.bin

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::process::ExitCode;
use std::sync::Mutex;
use std::thread;
use std::time::Instant;

use myomyw_engine::ai::value::Sample;
use myomyw_engine::ai::value::train::PolicyTarget;
use myomyw_engine::ai::{Agent, MctsAi, MctsParams};
use myomyw_engine::{Game, Rng, Side};

/// MCTS parameters from an agent spec: `impossible`, `mcts` or `mcts:<options>`.
fn params(spec: &str) -> Result<MctsParams, String> {
    match spec {
        "impossible" | "mcts" => Ok(MctsParams::default()),
        _ => MctsParams::parse(spec.strip_prefix("mcts:").ok_or_else(|| format!("not an MCTS agent: \"{spec}\""))?),
    }
}

fn main() -> ExitCode {
    let mut a = "mcts:iters=1600".to_string();
    let mut b: Option<String> = None;
    let mut games = 100u32;
    let mut seed = 1u32;
    let mut out = "selfplay.bin".to_string();
    let mut threads = thread::available_parallelism().map_or(1, |n| n.get());
    let mut args = std::env::args().skip(1);
    while let Some(flag) = args.next() {
        let Some(v) = args.next() else {
            eprintln!("missing value for {flag}");
            return ExitCode::FAILURE;
        };
        match flag.as_str() {
            "--a" => a = v,
            "--b" => b = Some(v),
            "--games" => games = v.parse().unwrap(),
            "--seed" => seed = v.parse().unwrap(),
            "--out" => out = v,
            "--threads" => threads = v.parse().unwrap(),
            _ => {
                eprintln!("unknown flag {flag}");
                return ExitCode::FAILURE;
            }
        }
    }
    let b = b.unwrap_or_else(|| a.clone());
    let (pa, pb) = match (params(&a), params(&b)) {
        (Ok(pa), Ok(pb)) => (pa, pb),
        (Err(e), _) | (_, Err(e)) => {
            eprintln!("{e}");
            return ExitCode::FAILURE;
        }
    };
    let pol = Path::new(&out).with_extension("pol");
    let writers = Mutex::new((
        BufWriter::new(File::create(&out).expect("cannot create output")),
        BufWriter::new(File::create(&pol).expect("cannot create policy output")),
    ));
    let started = Instant::now();
    let (positions, left_wins) = thread::scope(|scope| {
        let handles: Vec<_> = (0..threads)
            .map(|t| {
                let (pa, pb, writers) = (&pa, &pb, &writers);
                scope.spawn(move || {
                    let (mut positions, mut left_wins) = (0usize, 0u32);
                    for i in (t as u32..games).step_by(threads) {
                        let base = seed.wrapping_mul(1_000_003).wrapping_add(i.wrapping_mul(3));
                        let mut rng = Rng::new(base);
                        let (sa, sb) = if i % 2 == 0 { (pa, pb) } else { (pb, pa) };
                        let mut left = MctsAi::new(sa.clone(), base + 1);
                        let mut right = MctsAi::new(sb.clone(), base + 2);
                        let mut game = Game::new(&mut rng);
                        // Each decision: the position (as the host sees it), the search value and the visits.
                        let mut states: Vec<(Game, f32, Option<PolicyTarget>)> = Vec::new();
                        let mut turns = 0;
                        while !game.is_over() && turns < 2000 {
                            let agent = if game.turn == Side::Left { &mut left } else { &mut right };
                            agent.begin_turn(&game.view());
                            let before = game;
                            let col = agent.first_push(game.next);
                            let view = Sample::from_game(&before, 0.0, 0.0).game();
                            states.push((before, agent.last_value(), PolicyTarget::from_visits(&view, &agent.root_visits())));
                            let mut outcome = game.push(col, &mut rng);
                            while outcome.result.is_none() && !outcome.turn_ended {
                                let before = game;
                                let again = agent.push_again(game.next);
                                let view = Sample::from_game(&before, 0.0, 0.0).game();
                                states.push((before, agent.last_value(), PolicyTarget::from_visits(&view, &agent.root_visits())));
                                if !again {
                                    game.end_turn();
                                    break;
                                }
                                outcome = game.push(col, &mut rng);
                            }
                            turns += 1;
                        }
                        let Some(result) = game.result else { continue };
                        left_wins += u32::from(result.winner == Side::Left);
                        let mut bytes = Vec::with_capacity(states.len() * 64);
                        let mut policies = Vec::with_capacity(states.len() * PolicyTarget::BYTES);
                        for (k, (s, v, policy)) in states.iter().enumerate() {
                            let target = if s.turn == result.winner { 1.0 } else { -1.0 };
                            let mut sample = Sample::from_game(s, target, *v);
                            sample.start = k == 0;
                            bytes.extend_from_slice(&sample.to_bytes());
                            policies.extend_from_slice(&PolicyTarget::encode(policy.as_ref()));
                        }
                        positions += states.len();
                        let mut w = writers.lock().unwrap();
                        w.0.write_all(&bytes).unwrap();
                        w.1.write_all(&policies).unwrap();
                    }
                    (positions, left_wins)
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).fold((0, 0), |x, y| (x.0 + y.0, x.1 + y.1))
    });
    let (mut w_bin, mut w_pol) = writers.into_inner().unwrap();
    w_bin.flush().unwrap();
    w_pol.flush().unwrap();
    println!(
        "{games} games, {positions} positions, Left won {:.1}%, {:.1}s",
        100.0 * f64::from(left_wins) / f64::from(games),
        started.elapsed().as_secs_f64()
    );
    ExitCode::SUCCESS
}
