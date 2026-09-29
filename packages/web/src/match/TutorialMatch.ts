import { Ball, RULES, Side } from "@myomyw/engine";
import { LocalMatch } from "./LocalMatch.ts";

/** Number of tutorial steps; texts live in i18n under `tutorial.steps`. */
export const TUTORIAL_STEPS = 7;

/**
 * The guided tutorial: the player (Left) makes one real turn against an idle
 * opponent, then special balls are placed on the board one kind at a time.
 * The first upcoming ball is a Key ball so the player sees one enter the board.
 *
 * Steps: 0 intro · 1 make a turn · 2 Key ball · 3 AddCol/DelCol · 4 Flip ·
 * 5 upcoming ball · 6 done.
 */
export class TutorialMatch extends LocalMatch {
  constructor(playerName: string, opponentName: string) {
    let first = true;
    super({
      seats: [{ kind: "human" }, { kind: "idle" }],
      names: [playerName, opponentName],
      // The tutorial teaches the standard limit, whatever the settings say.
      timeLimitMs: RULES.turnTimeLimitMs,
      autoStart: false,
      ballSource: () => {
        if (!first) return Ball.Common;
        first = false;
        return Ball.Key;
      },
    });
    this.update({ tutorialStep: 0 });
  }

  /** Whether the current step waits for the player to press "Next". */
  get waitsForNext(): boolean {
    return this.state.tutorialStep !== 1;
  }

  advance(): void {
    const step = this.state.tutorialStep ?? 0;
    switch (step) {
      case 0:
        this.start();
        break;
      case 2:
        if (this.isCommon(3, 1) && this.isCommon(1, 3)) {
          this.place(3, 1, Ball.AddCol);
          this.place(1, 3, Ball.DelCol);
        } else {
          this.place(4, 1, Ball.AddCol);
          this.place(1, 4, Ball.DelCol);
        }
        break;
      case 3:
        if (this.isCommon(3, 3)) this.place(3, 3, Ball.Flip);
        else this.place(2, 2, Ball.Flip);
        break;
      case 1:
      case 6:
        return;
    }
    this.update({ tutorialStep: step + 1 });
  }

  protected override onTurnStart(): void {
    if (this.state.tutorialStep === 1 && this.game.turn === Side.Right) {
      this.stopTimer();
      this.update({ tutorialStep: 2 });
    }
  }

  private isCommon(l: number, r: number): boolean {
    return this.game.board.cells[l]![r] === Ball.Common;
  }

  private place(l: number, r: number, ball: Ball): void {
    this.game.setBall(l, r, ball);
    this.display.setBall(l, r, ball);
    this.update({ balls: this.display.sprites(), entering: null, animMs: this.timing.pushMs });
  }
}
