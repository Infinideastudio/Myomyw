/**
 * Headless AI-vs-AI tournament.
 *
 *   npm run arena -- --a hard --b normal --games 200 --seed 1
 *
 * Agents alternate sides every game (Left moves first, which matters).
 * Agent specs: easy | normal | hard | strong:<maxDepth>,<fillout>
 */
import { parseArgs } from "node:util";
import { Side, StrongAI, createAgent, playMatch, seededRng, type Agent, type Difficulty, type Rng } from "../src/index.ts";

const { values } = parseArgs({
  options: {
    a: { type: "string", default: "hard" },
    b: { type: "string", default: "normal" },
    games: { type: "string", default: "100" },
    seed: { type: "string", default: "1" },
  },
});

function makeAgent(spec: string, rng: Rng): Agent {
  const strong = /^strong:(\d+),(\d+)$/.exec(spec);
  if (strong) return new StrongAI(Number(strong[1]), Number(strong[2]), rng);
  if (spec === "easy" || spec === "normal" || spec === "hard") return createAgent(spec as Difficulty, rng);
  throw new Error(`Unknown agent "${spec}"`);
}

const games = Number(values.games);
const seed = Number(values.seed);
const wins = { a: 0, b: 0, draws: 0 };
const firstMoverWins = { a: 0, b: 0 };
let turns = 0;
const started = performance.now();

for (let i = 0; i < games; i++) {
  const a = makeAgent(values.a, seededRng(seed * 1_000_003 + i * 3 + 1));
  const b = makeAgent(values.b, seededRng(seed * 1_000_003 + i * 3 + 2));
  const aIsLeft = i % 2 === 0;
  const result = aIsLeft
    ? playMatch(a, b, { rng: seededRng(seed * 1_000_003 + i * 3) })
    : playMatch(b, a, { rng: seededRng(seed * 1_000_003 + i * 3) });
  turns += result.turns;
  if (result.winner === null) {
    wins.draws++;
    continue;
  }
  const aWon = (result.winner === Side.Left) === aIsLeft;
  if (aWon) wins.a++;
  else wins.b++;
  if (result.winner === Side.Left) firstMoverWins[aIsLeft ? "a" : "b"]++;
}

const seconds = (performance.now() - started) / 1000;
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
console.log(`A = ${values.a}, B = ${values.b}, ${games} games (seed ${seed}), ${seconds.toFixed(1)}s`);
console.log(`A wins: ${wins.a} (${pct(wins.a)})   [as first mover: ${firstMoverWins.a}]`);
console.log(`B wins: ${wins.b} (${pct(wins.b)})   [as first mover: ${firstMoverWins.b}]`);
if (wins.draws) console.log(`Unfinished: ${wins.draws}`);
console.log(`Average turns per game: ${(turns / games).toFixed(1)}`);
