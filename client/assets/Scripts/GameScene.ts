import EventTouch = cc.Event.EventTouch;
import {Chessboard, Turn} from "./Chessboard";
import {Chessman} from "./Chessman";

const {ccclass, property} = cc._decorator;

@ccclass
export class GameScene extends cc.Component {
    boardLength: number = 1000;

    @property(cc.Node)
    gridNode: cc.Node = new cc.Node();

    // grids/ejectors textures
    @property(cc.SpriteFrame)
    greenEjectorSpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    blueEjectorSpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    grid1SpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    grid2SpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();

    // chessman textures
    @property(cc.SpriteFrame)
    commonChessman: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    addColChessman: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    delColChessman: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    flipChessman: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    keyChessman: cc.SpriteFrame = new cc.SpriteFrame();

    chessBoard: Chessboard = new Chessboard();
    chessmanNode: cc.Node | null = null;

    get lCol(): number {
        return this.chessBoard.getLCol();
    }

    get rCol(): number {
        return this.chessBoard.getRCol();
    }

    get gridWidth(): number {
        return this.boardLength / (this.lCol + this.rCol + 2);
    }

    public onLoad(): void {
        this.buildChessboard();
    }

    public generateNextChessman(): Chessman {
        switch (Math.floor(Math.random() * 11)) {
            case 0:
                return Chessman.Key;
            case 1:
                return Chessman.AddCol;
            case 2:
                return Chessman.DelCol;
            case 3:
                return Chessman.Flip;
            default:
                return Chessman.Common;
        }
    }

    private onEjectorClicked(e: EventTouch) {
        const turn = e.target.name[0] === "L" ? Turn.Left : Turn.Right;
        const col = Number(e.target.name.substr(1));
        this.chessBoard.move(turn, col, this.generateNextChessman());
        if (this.chessBoard.boardUpdate) {
            this.chessBoard.boardUpdate = false;
            this.buildChessboard(); // also updates chessman
        } else {
            this.renderChessman();
        }
    }

    private onEjectorLeave(e: EventTouch) {
    }

    public buildChessboard(): void {
        let drawLCol = this.lCol + 1, drawRCol = this.rCol + 1; // Number of grids including ejectors

        // Grids (including ejectors)
        this.gridNode.removeAllChildren();
        const gridSpriteFrameWidth = this.grid1SpriteFrame.getOriginalSize().width;
        const scale = this.gridWidth / gridSpriteFrameWidth;

        for (let l = 0; l < drawLCol; l++) {
            for (let r = 0; r < drawRCol; r++) {
                let gridNode = new cc.Node();
                let grid = gridNode.addComponent(cc.Sprite);
                let ejector = false;
                if (l == 0 && r == 0) {
                    continue;
                } else if (r == 0) {
                    grid.spriteFrame = this.greenEjectorSpriteFrame;
                    gridNode.name = "L" + (l - 1).toString();
                    ejector = true;
                } else if (l == 0) {
                    grid.spriteFrame = this.blueEjectorSpriteFrame;
                    gridNode.name = "R" + (r - 1).toString();
                    ejector = true;
                } else if ((l + r) % 2 == 0) {
                    grid.spriteFrame = this.grid1SpriteFrame;
                } else {
                    grid.spriteFrame = this.grid2SpriteFrame;
                }
                if (ejector) {
                    gridNode.on(cc.Node.EventType.TOUCH_START, this.onEjectorClicked, this);
                    gridNode.on(cc.Node.EventType.TOUCH_END, this.onEjectorLeave, this);
                }

                gridNode.scale = scale;
                gridNode.setPosition(l * this.gridWidth, r * this.gridWidth);

                this.gridNode.addChild(gridNode);
            }
        }
        this.chessmanNode = new cc.Node();
        this.gridNode.addChild(this.chessmanNode);
        this.renderChessman();
    }

    public renderChessman() {
        let chessmenNode = this.chessmanNode!;
        const gridSpriteFrameWidth = this.commonChessman.getOriginalSize().width;
        const scale = this.gridWidth / gridSpriteFrameWidth * 0.8;
        chessmenNode.removeAllChildren();
        for (let l = 0; l < this.lCol; l++) {
            for (let r = 0; r < this.rCol; r++) {
                let chessmanNode = new cc.Node();
                let chessmanSprite = chessmanNode.addComponent(cc.Sprite);
                let spriteFrame = this.getSpriteFrameByChessman(this.chessBoard.getChess(l, r));
                if (spriteFrame === null) continue;
                chessmanSprite.spriteFrame = spriteFrame;
                chessmanNode.setPosition(
                    (l + 1) * this.gridWidth,
                    (r + 1) * this.gridWidth
                );
                chessmanNode.name = (l * this.rCol + r).toString();
                chessmanNode.scale = scale;
                chessmenNode.addChild(chessmanNode);
            }
        }
    }

    private getSpriteFrameByChessman(chessman: Chessman): cc.SpriteFrame | null {
        switch (chessman) {
            case Chessman.AddCol:
                return this.addColChessman;
            case Chessman.DelCol:
                return this.delColChessman;
            case Chessman.Flip:
                return this.flipChessman;
            case Chessman.Key:
                return this.keyChessman;
            case Chessman.Common:
                return null;
        }
    }
}