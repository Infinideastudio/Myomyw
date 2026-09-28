//! Generates training data: plays games between two agents and writes every
//! decision position (from the mover's point of view) with the final result.
//!
//!   cargo run --release --bin selfplay -- --a mcts:iters=2000,cut=4 --games 1000 --out data.bin

use std::fs::File;
use std::io::{BufWriter, Write};
use std::process::ExitCode;
use std::sync::Mutex;
use std::thread;
use std::time::Instant;

use myomyw_engine::ai::agent_from_spec;
use myomyw_engine::ai::value::Sample;
use myomyw_engine::{Game, Rng, Side};

fn main() -> ExitCode {
    let mut a = "mcts:iters=2000,cut=4".to_string();
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
    if let Err(e) = agent_from_spec(&a, 0).and(agent_from_spec(&b, 0)) {
        eprintln!("{e}");
        return ExitCode::FAILURE;
    }
    let writer = Mutex::new(BufWriter::new(File::create(&out).expect("cannot create output")));
    let started = Instant::now();
    let (positions, left_wins) = thread::scope(|scope| {
        let handles: Vec<_> = (0..threads)
            .map(|t| {
                let (a, b, writer) = (&a, &b, &writer);
                scope.spawn(move || {
                    let (mut positions, mut left_wins) = (0usize, 0u32);
                    for i in (t as u32..games).step_by(threads) {
                        let base = seed.wrapping_mul(1_000_003).wrapping_add(i.wrapping_mul(3));
                        let mut rng = Rng::new(base);
                        let (sa, sb) = if i % 2 == 0 { (a, b) } else { (b, a) };
                        let mut left = agent_from_spec(sa, base + 1).unwrap();
                        let mut right = agent_from_spec(sb, base + 2).unwrap();
                        let mut game = Game::new(&mut rng);
                        let mut states: Vec<(Game, f32)> = Vec::new();
                        let mut turns = 0;
                        while !game.is_over() && turns < 2000 {
                            let agent = if game.turn == Side::Left { &mut left } else { &mut right };
                            agent.begin_turn(&game.view());
                            let before = game;
                            let col = agent.first_push(game.next);
                            states.push((before, agent.last_value().unwrap_or(0.0)));
                            let mut outcome = game.push(col, &mut rng);
                            while outcome.result.is_none() && !outcome.turn_ended {
                                let before = game;
                                let again = agent.push_again(game.next);
                                states.push((before, agent.last_value().unwrap_or(0.0)));
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
                        for (k, (s, v)) in states.iter().enumerate() {
                            let target = if s.turn == result.winner { 1.0 } else { -1.0 };
                            let mut sample = Sample::from_game(s, target, *v);
                            sample.start = k == 0;
                            bytes.extend_from_slice(&sample.to_bytes());
                        }
                        positions += states.len();
                        writer.lock().unwrap().write_all(&bytes).unwrap();
                    }
                    (positions, left_wins)
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).fold((0, 0), |x, y| (x.0 + y.0, x.1 + y.1))
    });
    writer.into_inner().unwrap().flush().unwrap();
    println!(
        "{games} games, {positions} positions, Left won {:.1}%, {:.1}s",
        100.0 * f64::from(left_wins) / f64::from(games),
        started.elapsed().as_secs_f64()
    );
    ExitCode::SUCCESS
}
