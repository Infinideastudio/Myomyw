//! Engine throughput: uniformly random playouts (the core loop of
//! simulation-based AIs) and built-in AI decision times.
//!
//!   cargo run --release --bin bench

use std::hint::black_box;
use std::time::Instant;

use myomyw_engine::ai::{Difficulty, create_agent};
use myomyw_engine::arena::play_match;
use myomyw_engine::{Game, Rng};

fn main() {
    // Random playouts from the initial position.
    let mut rng = Rng::new(1);
    let (mut playouts, mut actions) = (0u64, 0u64);
    let started = Instant::now();
    while started.elapsed().as_secs_f64() < 2.0 {
        for _ in 0..1000 {
            let mut game = Game::new(&mut rng);
            let mut steps = 0;
            while !game.is_over() && steps < 10_000 {
                let legal = game.actions();
                let action = legal[rng.below(legal.len() as u32) as usize];
                game.apply(action, &mut rng);
                steps += 1;
            }
            black_box(&game);
            playouts += 1;
            actions += steps;
        }
    }
    let seconds = started.elapsed().as_secs_f64();
    println!(
        "random playouts: {:.0}/s ({:.1} M actions/s, {:.1} actions per playout)",
        playouts as f64 / seconds,
        actions as f64 / seconds / 1e6,
        actions as f64 / playouts as f64
    );

    // Built-in AIs: average time per turn in self-play.
    for (name, difficulty, games) in
        [("normal", Difficulty::Normal, 50), ("hard", Difficulty::Hard, 50), ("impossible", Difficulty::Impossible, 2)]
    {
        let started = Instant::now();
        let mut turns = 0;
        for i in 0..games {
            let mut left = create_agent(difficulty, i * 2 + 1);
            let mut right = create_agent(difficulty, i * 2 + 2);
            turns += play_match(left.as_mut(), right.as_mut(), &mut Rng::new(i), 10_000).turns;
        }
        println!("{name} vs {name}: {:.3} ms per turn", started.elapsed().as_secs_f64() * 1e3 / f64::from(turns));
    }
}
