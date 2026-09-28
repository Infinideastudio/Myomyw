import { describe, expect, it } from "vitest";
import { Ball, Board, Game, IllegalMoveError, RULES, Side, StrongAI, WeakAI, playMatch, randomBall, seededRng } from "../src/index.ts";

/** A game whose upcoming balls are taken from `balls` (then common balls). */
function scripted(balls: Ball[], board?: Board): Game {
  const queue = balls.slice();
  return new Game({ board, ballSource: () => queue.shift() ?? Ball.Common });
}

describe("Game rules", () => {
  it("starts with a 6x6 board of common balls, Left to move", () => {
    const game = new Game();
    expect(game.turn).toBe(Side.Left);
    expect(game.board.lCol).toBe(6);
    expect(game.board.rCol).toBe(6);
    for (let l = 0; l < 6; l++) for (let r = 0; r < 6; r++) expect(game.board.cells[l]![r]).toBe(Ball.Common);
  });

  it("inserts the upcoming ball at the ejector end and pushes one off the far end", () => {
    const board = Board.initial();
    board.cells[2]![5] = Ball.DelCol;
    board.cells[5]![1] = Ball.AddCol;
    const game = scripted([Ball.Flip, Ball.Key, Ball.Common], board);
    const left = game.push(2);
    expect(left.inserted).toBe(Ball.Flip);
    expect(left.ejected).toBe(Ball.DelCol);
    expect(game.board.cells[2]![0]).toBe(Ball.Flip);
    game.endTurn();
    const right = game.push(1);
    expect(right.inserted).toBe(Ball.Key);
    expect(right.ejected).toBe(Ball.AddCol);
    expect(game.board.cells[0]![1]).toBe(Ball.Key);
  });

  it("lets a player push the same line up to 5 times, then passes the turn", () => {
    const game = scripted([]);
    for (let i = 1; i < RULES.maxPushesPerTurn; i++) {
      const o = game.push(3);
      expect(o.turnEnded).toBe(false);
      expect(game.canPush(2)).toBe(false);
    }
    const last = game.push(3);
    expect(last.turnEnded).toBe(true);
    expect(game.turn).toBe(Side.Right);
  });

  it("requires at least one push before ending the turn", () => {
    const game = scripted([]);
    expect(() => game.endTurn()).toThrow(IllegalMoveError);
    game.push(0);
    game.endTurn();
    expect(game.turn).toBe(Side.Right);
  });

  it("rejects lines outside the player's ejectors", () => {
    const game = scripted([]);
    expect(() => game.push(6)).toThrow(IllegalMoveError);
    expect(() => game.push(-1)).toThrow(IllegalMoveError);
  });

  it("makes the player who pushes the Key ball off lose", () => {
    const board = Board.initial();
    board.cells[0]![5] = Ball.Key;
    const game = scripted([], board);
    const o = game.push(0);
    expect(o.result).toEqual({ winner: Side.Right, reason: "key" });
    expect(game.canPush(0)).toBe(false);
  });

  it("gives the opponent a line when an AddCol ball is pushed off (max 10)", () => {
    const board = Board.initial();
    board.cells[1]![5] = Ball.AddCol;
    const game = scripted([], board);
    game.push(1);
    expect(game.board.rCol).toBe(7);
    expect(game.board.lCol).toBe(6);
    for (let l = 0; l < 6; l++) expect(game.board.cells[l]![6]).toBe(Ball.Common);

    const full = Board.initial();
    full.resize(6, 10);
    full.cells[0]![9] = Ball.AddCol;
    const g2 = scripted([], full);
    g2.push(0);
    expect(g2.board.rCol).toBe(10);
  });

  it("takes a line from the opponent when a DelCol ball is pushed off (min 3)", () => {
    const board = Board.initial();
    board.cells[5]![4] = Ball.DelCol;
    const game = scripted([], board);
    game.push(0);
    game.endTurn();
    game.push(4); // Right pushes line 4; ball at [5][4] falls off
    expect(game.board.lCol).toBe(5);
    expect(game.board.rCol).toBe(6);

    const small = Board.initial();
    small.resize(3, 6);
    small.cells[2]![0] = Ball.DelCol;
    const g2 = scripted([], small);
    g2.push(0);
    g2.endTurn();
    g2.push(0);
    expect(g2.board.lCol).toBe(3);
  });

  it("mirrors the board and ends the turn when a Flip ball is pushed off", () => {
    const board = Board.initial();
    board.resize(4, 7);
    board.cells[0]![6] = Ball.Flip;
    board.cells[3]![2] = Ball.Key;
    const game = scripted([Ball.DelCol], board);
    const o = game.push(0);
    expect(o.turnEnded).toBe(true);
    expect(game.turn).toBe(Side.Right);
    expect(game.board.lCol).toBe(7);
    expect(game.board.rCol).toBe(4);
    expect(game.board.cells[2]![3]).toBe(Ball.Key);
    expect(game.board.cells[0]![0]).toBe(Ball.DelCol);
  });

  it("handles timeouts and resignations", () => {
    const game = scripted([]);
    expect(game.timeout()).toEqual({ winner: Side.Right, reason: "timeout" });
    const g2 = scripted([]);
    expect(g2.forfeit(Side.Right)).toEqual({ winner: Side.Left, reason: "resign" });
  });

  it("draws balls with probabilities 7/11 common and 1/11 per special kind", () => {
    const rng = seededRng(7);
    const counts = [0, 0, 0, 0, 0];
    const n = 110_000;
    for (let i = 0; i < n; i++) counts[randomBall(rng)]!++;
    expect(counts[Ball.Common]! / n).toBeCloseTo(7 / 11, 2);
    for (const b of [Ball.Key, Ball.AddCol, Ball.DelCol, Ball.Flip]) expect(counts[b]! / n).toBeCloseTo(1 / 11, 2);
  });
});

describe("playMatch", () => {
  it("plays complete, reproducible games", () => {
    const run = () => playMatch(new StrongAI(1, 10, seededRng(1)), new WeakAI(), { rng: seededRng(2) });
    const a = run();
    const b = run();
    expect(a.winner).not.toBeNull();
    expect(a.winner).toBe(b.winner);
    expect(a.pushes).toBe(b.pushes);
  });
});
