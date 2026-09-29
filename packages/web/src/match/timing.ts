/** Pacing of a match, in milliseconds. */
export interface Timing {
  /** Duration of one push animation. */
  pushMs: number;
  /** Pause between two pushes while an ejector is held (or an AI keeps pushing). */
  coolMs: number;
  /** Board grow/shrink animation. */
  resizeMs: number;
  /** Board mirror animation. */
  flipMs: number;
  /** Pause before a computer player's first push (it thinks meanwhile). */
  aiThinkMs: number;
}

/** The pacing of the original game. */
export const NORMAL_TIMING: Timing = { pushMs: 300, coolMs: 400, resizeMs: 200, flipMs: 400, aiThinkMs: 800 };

/** For watching AI-vs-AI games quickly. */
export const QUICK_TIMING: Timing = { pushMs: 50, coolMs: 50, resizeMs: 50, flipMs: 50, aiThinkMs: 0 };
