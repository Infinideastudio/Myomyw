//! Seedable random numbers, bit-identical to `seededRng` / `randomBall` in `@myomyw/core`.

use crate::ball::Ball;

/// The mulberry32 generator. The same seed produces the same sequence as the
/// TypeScript implementation, which lets tests compare both engines move for move.
#[derive(Clone, Debug)]
pub struct Rng {
    state: u32,
}

impl Rng {
    pub const fn new(seed: u32) -> Rng {
        Rng { state: seed }
    }

    #[inline]
    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        t ^ (t >> 14)
    }

    /// Uniform in [0, 1), like `Math.random()`.
    #[inline]
    pub fn next_f64(&mut self) -> f64 {
        f64::from(self.next_u32()) / 4_294_967_296.0
    }

    /// Uniform integer in `0..n`.
    #[inline]
    pub fn below(&mut self, n: u32) -> u32 {
        ((u64::from(self.next_u32()) * u64::from(n)) >> 32) as u32
    }

    /// A ball from the official distribution: 1/11 for each special kind, 7/11 common.
    #[inline]
    pub fn ball(&mut self) -> Ball {
        // Equals floor(next_f64() * 11) exactly, as in the TypeScript version.
        match self.below(11) {
            0 => Ball::Key,
            1 => Ball::AddCol,
            2 => Ball::DelCol,
            3 => Ball::Flip,
            _ => Ball::Common,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_typescript_generator() {
        let mut rng = Rng::new(1);
        let values: Vec<u32> = (0..5).map(|_| rng.next_u32()).collect();
        assert_eq!(values, [2693262067, 11749833, 2265367787, 4213581821, 4159151403]);

        let mut rng = Rng::new(42);
        let balls: Vec<u8> = (0..20).map(|_| rng.ball() as u8).collect();
        assert_eq!(balls, [0, 0, 0, 0, 2, 0, 4, 0, 0, 0, 3, 0, 0, 4, 3, 0, 0, 0, 1, 0]);
    }
}
