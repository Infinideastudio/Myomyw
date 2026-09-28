import { Side } from "../constants.ts";
import { Game, type GameOptions, type PushOutcome } from "../game.ts";
import type { Agent } from "./agent.ts";

export interface MatchOptions extends GameOptions {
  /** Declare a draw after this many turns (safety net; real games end far sooner). */
  maxTurns?: number;
  /** Called after every push. */
  onPush?: (outcome: PushOutcome, game: Game) => void;
}

export interface MatchResult {
  /** null if `maxTurns` was reached. */
  winner: Side | null;
  turns: number;
  pushes: number;
  game: Game;
}

/** Plays one complete game between two agents, as fast as possible (no timer). */
export function playMatch(left: Agent, right: Agent, options: MatchOptions = {}): MatchResult {
  const game = new Game(options);
  const maxTurns = options.maxTurns ?? 10_000;
  let turns = 0;
  let pushes = 0;
  const push = (col: number): PushOutcome => {
    const outcome = game.push(col);
    pushes++;
    options.onPush?.(outcome, game);
    return outcome;
  };

  while (!game.over && turns < maxTurns) {
    const agent = game.turn === Side.Left ? left : right;
    agent.beginTurn(game.board.viewFor(game.turn));
    const col = agent.firstPush(game.next);
    let outcome = push(col);
    while (!outcome.result && !outcome.turnEnded) {
      if (!agent.pushAgain(game.next)) {
        game.endTurn();
        break;
      }
      outcome = push(col);
    }
    turns++;
  }
  return { winner: game.result?.winner ?? null, turns, pushes, game };
}
