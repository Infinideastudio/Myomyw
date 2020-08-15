import {maxCol, minCol} from "./config";
import {Chessman, ChessmanWithData} from "./Chessman";

export enum Turn {
    Left,
    Right
}

export enum ChessboardChangeType {
    Left, Right, Spawn, Despawn
}

export type ChessboardChange = {
    target: string,
    type: ChessboardChangeType,
    lCol: number,
    rCol: number
}

export class Chessboard {
    public winner: Turn | null = null; //胜利者，游戏未结束时为null
    public chessboardChanges: ChessboardChange[] = [];
    public chessboardSizeChanged: boolean = false;

    public getLCol(): number {
        return this.lCol;
    }

    public getRCol(): number {
        return this.rCol;
    }

    public getChess(x: number, y: number): ChessmanWithData {
        return this.board[x][y];
    }

    private lCol: number = 5;
    private rCol: number = 5;
    private board: ChessmanWithData[][] = [];
    private handlers: ((turn: Turn) => boolean)[] = []; //返回值表示是否可以继续移动

    private static createCommonChessman(): ChessmanWithData {
        return {type: Chessman.Common, data: ""};
    }

    private setBoardSize(lCol: number, rCol: number): void { //从原项目抄来的
        if (lCol > maxCol || lCol < minCol || rCol > maxCol || rCol < minCol) return;

        //如果棋盘变大，把多出来的部分设置为普通球
        //假设只有一边变大
        if (this.lCol == lCol - 1) {
            for (let r = 0; r < rCol; r++) {
                this.board[lCol][r] = Chessboard.createCommonChessman();
            }
        } else if (this.rCol == rCol - 1) {
            for (let l = 0; l < lCol; l++) {
                this.board[l][rCol] = Chessboard.createCommonChessman();
            }
        } else {
            console.error("unexpected (" + this.lCol + "," + this.rCol + ") to (" + lCol + "," + rCol + ")");
        }

        this.chessboardSizeChanged = true;

        this.lCol = lCol;
        this.rCol = rCol;
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
        this.chessboardSizeChanged = true;
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
                this.board[l][r] = Chessboard.createCommonChessman();
            }
        }
        this.handlers[Chessman.Common] = (_: Turn) => true;
        this.handlers[Chessman.AddCol] = this.handlerAddCol.bind(this);
        this.handlers[Chessman.DelCol] = this.handlerDelCol.bind(this);
        this.handlers[Chessman.Flip] = this.handlerFlip.bind(this);
        this.handlers[Chessman.Key] = this.handlerKey.bind(this);
    }

    public move(turn: Turn, col: number, nextChessman: ChessmanWithData) {
        if (turn === Turn.Left) {
            if (col >= 0 && col < this.lCol) {
                let lastChessman = this.board[col][this.rCol - 1];
                for (let i = this.rCol - 1; i > 0; i--) {
                    this.board[col][i] = this.board[col][i - 1];

                    this.chessboardChanges.push({
                        target: this.board[col][i].data,
                        type: ChessboardChangeType.Left,
                        lCol: col,
                        rCol: i - 1
                    });
                }

                this.board[col][0] = nextChessman;

                this.chessboardChanges.push({
                    target: nextChessman.type.valueOf().toString(),
                    type: ChessboardChangeType.Spawn,
                    lCol: col,
                    rCol: 0
                });

                this.chessboardChanges.push({
                    target: lastChessman.data,
                    type: ChessboardChangeType.Despawn,
                    lCol: 0,
                    rCol: 0
                });
                this.handlers[lastChessman.type](turn);
            } else {
                throw (new Error("col is not legal"))
            }
        } else {
            if (col >= 0 && col < this.rCol) {
                let lastChessman = this.board[this.lCol - 1][col];
                for (let i = this.lCol - 1; i > 0; i--) {
                    this.board[i][col] = this.board[i - 1][col];

                    this.chessboardChanges.push({
                        target: this.board[i][col].data,
                        type: ChessboardChangeType.Right,
                        lCol: i - 1,
                        rCol: col
                    });
                }

                this.board[0][col] = nextChessman;
                this.chessboardChanges.push({
                    target: nextChessman.type.valueOf().toString(),
                    type: ChessboardChangeType.Spawn,
                    lCol: 0,
                    rCol: col
                });

                this.chessboardChanges.push({
                    target: lastChessman.data,
                    type: ChessboardChangeType.Despawn,
                    lCol: 0,
                    rCol: 0
                });
                this.handlers[lastChessman.type](turn);
            } else {
                throw (new Error("col is not legal"))
            }
        }
    }

}