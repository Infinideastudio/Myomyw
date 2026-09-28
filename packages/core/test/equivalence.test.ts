/**
 * Proves that the rules engine and the AI players are exact ports of the
 * original Beta 0.8 JavaScript (see test/legacy/).
 */
import { describe, expect, it } from "vitest";
import { Ball, Board, Game, RULES, Side, StrongAI, WeakAI, randomBall, seededRng, type Agent } from "../src/index.ts";
import { loadLegacy, type LegacyAI, type Legacy } from "./legacy.ts";

describe("Board matches legacy GameNode", () => {
  it("produces identical backing matrices over long random push sequences", () => {
    const legacy = loadLegacy();
    const rng = seededRng(12345);
    for (let game = 0; game < 200; game++) {
      const board = Board.initial();
      const node = new legacy.GameNode(board.cells, board.lCol, board.rCol);
      for (let step = 0; step < 300; step++) {
        const side = (rng() < 0.5 ? Side.Left : Side.Right) as Side;
        // Mostly legal lines, sometimes lines beyond the board (the Strong AI does that).
        const col = rng() < 0.9 ? Math.floor(rng() * board.ejectors(side)) : Math.floor(rng() * RULES.maxCols);
        const ball = randomBall(rng);
        expect(board.push(side, col, ball)).toBe(node.moveOnce(side, col, ball));
        expect(board.lCol).toBe(node.lCol);
        expect(board.rCol).toBe(node.rCol);
        expect(board.cells).toEqual(node.chessmen);
      }
    }
  });
});

type AgentFactory = { name: string; create: (rng: () => number) => Agent; legacy: (l: Legacy) => LegacyAI };

const easy: AgentFactory = { name: "easy", create: () => new WeakAI(), legacy: (l) => new l.WeakAI() };
const normal: AgentFactory = { name: "normal", create: (rng) => new StrongAI(1, 10, rng), legacy: (l) => new l.StrongAI(1, 10) };
const hard: AgentFactory = { name: "hard", create: (rng) => new StrongAI(2, 10, rng), legacy: (l) => new l.StrongAI(2, 10) };

interface Pair {
  agent: Agent;
  legacy: LegacyAI;
  legacyLib: Legacy;
}

function pair(factory: AgentFactory, seed: number): Pair {
  // Both implementations get their own copy of the same random stream.
  const legacyLib = loadLegacy(seededRng(seed));
  return { agent: factory.create(seededRng(seed)), legacy: factory.legacy(legacyLib), legacyLib };
}

/**
 * Plays a full game in which every decision is taken by the new agent and
 * checked against the legacy agent fed with the same inputs, driven the way
 * the original AIGameScene drove it.
 */
function playLockstep(leftF: AgentFactory, rightF: AgentFactory, seed: number): { decisions: number } {
  const players = [pair(leftF, seed * 2 + 1), pair(rightF, seed * 2 + 2)];
  const game = new Game({ rng: seededRng(seed) });
  let decisions = 0;
  let turns = 0;
  while (!game.over && turns++ < 2000) {
    const { agent, legacy, legacyLib } = players[game.turn]!;
    const view = game.board.viewFor(game.turn);
    agent.beginTurn(view.clone());
    legacy.loadGame(new legacyLib.GameNode(view.cells, view.lCol, view.rCol));
    const col = agent.firstPush(game.next);
    expect(col).toBe(legacy.firstMove(game.next));
    decisions++;
    let outcome = game.push(col);
    while (!outcome.result && !outcome.turnEnded) {
      const again = agent.pushAgain(game.next);
      expect(again).toBe(legacy.continue(game.next));
      decisions++;
      if (!again) {
        game.endTurn();
        break;
      }
      outcome = game.push(col);
    }
  }
  expect(game.over).toBe(true);
  return { decisions };
}

describe("AI players match the legacy implementations move for move", () => {
  const matchups: [AgentFactory, AgentFactory, number][] = [
    [easy, easy, 40],
    [easy, normal, 40],
    [normal, easy, 40],
    [normal, normal, 40],
    [hard, normal, 15],
    [easy, hard, 15],
    [hard, hard, 10],
  ];
  for (const [l, r, games] of matchups) {
    it(`${l.name} vs ${r.name}`, { timeout: 120_000 }, () => {
      let decisions = 0;
      for (let seed = 1; seed <= games; seed++) decisions += playLockstep(l, r, seed).decisions;
      expect(decisions).toBeGreaterThan(games * 5);
    });
  }

  it("covers positions where the search pushes lines beyond the board", { timeout: 120_000 }, () => {
    // Uneven board with stale Key balls outside the active area.
    const legacyLib = loadLegacy(seededRng(99));
    const board = Board.initial();
    for (let l = 0; l < RULES.maxCols; l++) for (let r = 0; r < RULES.maxCols; r++) board.cells[l]![r] = randomBall(seededRng(l * 10 + r));
    board.lCol = 9;
    board.rCol = 4;
    const agent = new StrongAI(2, 10, seededRng(99));
    const legacy = new legacyLib.StrongAI(2, 10);
    agent.beginTurn(board.clone());
    legacy.loadGame(new legacyLib.GameNode(board.cells, board.lCol, board.rCol));
    expect(agent.firstPush(Ball.Common)).toBe(legacy.firstMove(Ball.Common));
    for (let i = 0; i < 4; i++) {
      const again = agent.pushAgain(Ball.Common);
      expect(again).toBe(legacy.continue(Ball.Common));
      if (!again) break;
    }
  });
});
