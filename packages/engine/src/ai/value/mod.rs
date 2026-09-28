//! The learned value function of the Impossible AI: a small neural network
//! estimating the win probability of the player to move, trained on
//! self-play games (see docs/ai.md and `scripts/train.sh`).

pub mod features;
pub mod net;
pub mod train;

use std::sync::{Arc, OnceLock};

pub use features::{Features, Sample, extract};
pub use net::Net;

/// The trained weights shipped with the engine.
const WEIGHTS: &[u8] = include_bytes!("weights.bin");

/// The built-in value network (decoded once, then shared).
pub fn builtin_net() -> Arc<Net> {
    static NET: OnceLock<Arc<Net>> = OnceLock::new();
    NET.get_or_init(|| Arc::new(Net::from_bytes(WEIGHTS).expect("built-in network is valid"))).clone()
}
