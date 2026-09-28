//! Native AI-vs-AI tournament, the fast counterpart of `npm run arena`
//! (same agent specs and seeding, hence the same results).
//!
//!   cargo run --release --bin arena -- --a hard --b normal --games 1000 --seed 1

use std::process::ExitCode;
use std::thread;
use std::time::Instant;

use myomyw_engine::arena::tournament;

fn main() -> ExitCode {
    let mut a = "hard".to_string();
    let mut b = "normal".to_string();
    let mut games = 100u32;
    let mut seed = 1u32;
    let mut threads = thread::available_parallelism().map_or(1, |n| n.get());

    let mut args = std::env::args().skip(1);
    while let Some(flag) = args.next() {
        let value = args.next();
        let ok = match (flag.as_str(), &value) {
            ("--a", Some(v)) => {
                a = v.clone();
                true
            }
            ("--b", Some(v)) => {
                b = v.clone();
                true
            }
            ("--games", Some(v)) => v.parse().map(|n| games = n).is_ok(),
            ("--seed", Some(v)) => v.parse().map(|n| seed = n).is_ok(),
            ("--threads", Some(v)) => v.parse().map(|n| threads = n).is_ok(),
            _ => false,
        };
        if !ok {
            eprintln!("usage: arena [--a SPEC] [--b SPEC] [--games N] [--seed N] [--threads N]");
            eprintln!("SPEC: easy | normal | hard | strong:<maxDepth>,<fillout>");
            return ExitCode::FAILURE;
        }
    }

    let started = Instant::now();
    let result = match tournament(&a, &b, games, seed, threads) {
        Ok(result) => result,
        Err(error) => {
            eprintln!("{error}");
            return ExitCode::FAILURE;
        }
    };
    let seconds = started.elapsed().as_secs_f64();
    let pct = |n: u32| 100.0 * f64::from(n) / f64::from(games);
    println!("A = {a}, B = {b}, {games} games (seed {seed}), {seconds:.1}s on {threads} threads");
    println!("A wins: {} ({:.1}%)   [as first mover: {}]", result.a_wins, pct(result.a_wins), result.a_first_mover_wins);
    println!("B wins: {} ({:.1}%)   [as first mover: {}]", result.b_wins, pct(result.b_wins), result.b_first_mover_wins);
    if result.unfinished > 0 {
        println!("Unfinished: {}", result.unfinished);
    }
    println!("Average turns per game: {:.1}", result.turns as f64 / f64::from(games));
    ExitCode::SUCCESS
}
