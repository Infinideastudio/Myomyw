import {maxCol, minCol} from "./config";
import {Chessman} from "./Chessman";

export enum Turn {
    Left,
    Right
}

export class Chessboard {
    public boardUpdate: boolean = false; //表示棋盘和棋子绘图是否需要更新。更新完成后将标志设为false
    public winner: Turn | null = null; //胜利者，游戏未结束时为null

    public getLCol(): number {
        return this.lCol;
    }

    public getRCol(): number {
        return this.rCol;
    }

    public getChess(x: number, y: number): Chessman {
        return this.board[x][y];
    }

    private lCol: number = 5;
    private rCol: number = 5;
    private board: Chessman[][] = [];
    private handlers: ((turn: Turn) => boolean)[] = []; //返回值表示是否可以继续移动

    private setBoardSize(lCol: number, rCol: number): void { //从原项目抄来的
        if (lCol <= maxCol && lCol >= minCol && rCol <= maxCol && rCol >= minCol) {
            //如果棋盘变大，把多出来的部分设置为普通球
            if (this.lCol < lCol) {
                for (let l = this.lCol; l < lCol; l++) {
                    for (let r = 0; r < rCol; r++) {
                        this.board[l][r] = Chessman.Common;
                    }
                }
            }
            if (this.rCol < rCol) {
                for (let l = 0; l < lCol; l++) {
                    for (let r = this.rCol; r < rCol; r++) {
                        this.board[l][r] = Chessman.Common;
                    }
                }
            }
            this.lCol = lCol;
            this.rCol = rCol;
            this.boardUpdate = true;
        }
    }

    private handlerAddCol(turn: Turn): boolean {
        if (turn === Turn.Left) {
            this.setBoardSize(this.lCol, this.rCol + 1);
        } else {
            this.setBoardSize(this.lCol + 1, this.rCol);
        }
        return true;
    }

    private handlerDelCol(turn: Turn): boolean {
        if (turn === Turn.Left) {
            this.setBoardSize(this.lCol, this.rCol - 1);
        } else {
            this.setBoardSize(this.lCol - 1, this.rCol);
        }
        return true;
    }

    private handlerFlip(turn: Turn): boolean {
        let larger = Math.max(this.lCol, this.rCol);
        for (let l = 0; l < maxCol; l++) {
            for (let r = l + 1; r < maxCol; r++) {
                let temp = this.board[l][r];
                this.board[l][r] = this.board[r][l];
                this.board[r][l] = temp;
            }
        }
        let temp = this.rCol;
        this.rCol = this.lCol;
        this.lCol = temp;
        this.boardUpdate = true;
        return false;
    }

    private handlerKey(turn: Turn): boolean {
        this.winner = turn === Turn.Left ? Turn.Right : Turn.Left;
        return true;
    }

    constructor() {
        for (let l = 0; l < maxCol; l++) {
            this.board[l] = [];
            for (let r = 0; r < maxCol; r++) {
                this.board[l][r] = Chessman.Common;
            }
        }
        this.handlers[Chessman.Common] = (_: Turn) => true;
        this.handlers[Chessman.AddCol] = this.handlerAddCol.bind(this);
        this.handlers[Chessman.DelCol] = this.handlerDelCol.bind(this);
        this.handlers[Chessman.Flip] = this.handlerFlip.bind(this);
        this.handlers[Chessman.Key] = this.handlerKey.bind(this);
    }

    public move(turn: Turn, col: number, nextChessman: Chessman) {
        if (turn === Turn.Left) {
            if (col >= 0 && col < this.lCol) {
                let lastChessman = this.board[col][this.rCol - 1];
                for (let i = this.rCol - 1; i > 0; i--) {
                    this.board[col][i] = this.board[col][i - 1];
                }
                this.board[col][0] = nextChessman;
                this.handlers[lastChessman](turn);
            } else {
                throw (new Error("col is not legal"))
            }
        } else {
            if (col >= 0 && col < this.rCol) {
                let lastChessman = this.board[this.lCol - 1][col];
                for (let i = this.lCol - 1; i > 0; i--) {
                    this.board[i][col] = this.board[i - 1][col];
                }
                this.board[0][col] = nextChessman;
                this.handlers[lastChessman](turn);
            } else {
                throw (new Error("col is not legal"))
            }
        }
    }

}