import EventTouch = cc.Event.EventTouch;
import {Chessboard, ChessboardChangeType, Turn} from "./Chessboard";
import {Chessman} from "./Chessman";
import {maxCol} from "./config";

const {ccclass, property} = cc._decorator;

@ccclass
export class GameScene extends cc.Component {
    boardLength: number = 1000;
    animationDuration: number = 0.5;

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
    boardBusy: boolean = false;
    touchTimeout: number = 0;

    get lCol(): number {
        return this.chessBoard.getLCol();
    }

    get rCol(): number {
        return this.chessBoard.getRCol();
    }

    get gridWidth(): number {
        return this.boardLength / (this.lCol + this.rCol + 2);
    }

    get chessmanScale(): number {
        return this.gridWidth / this.commonChessman.getOriginalSize().width * 0.8;
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

    // Generate a chessman node if type is not Common
    public generateChessmanNode(type: Chessman, lCol: number, rCol: number): cc.Node | null {
        let chessmanNode = new cc.Node();
        let chessmanSprite = chessmanNode.addComponent(cc.Sprite);
        let spriteFrame = this.getSpriteFrameByChessman(type);
        if (spriteFrame === null) return null;
        chessmanSprite.spriteFrame = spriteFrame;
        chessmanNode.scale = this.chessmanScale;
        chessmanNode.setPosition(
            this.gridWidth * (lCol + 1),
            this.gridWidth * (rCol + 1)
        );
        chessmanNode.name = GameScene.getNameFromLoc(lCol, rCol);
        this.chessmanNode!.addChild(chessmanNode);
        return chessmanNode
    }

    private onEjectorClicked(e: EventTouch) {
        if (this.boardBusy || this.touchTimeout != 0) return;
        this.boardBusy = true;
        setTimeout(() => {
            this.boardBusy = false;
        }, this.animationDuration * 1000);
        this.touchTimeout = setTimeout(() => {
            this.touchTimeout = 0;
            this.onEjectorClicked(e);
        }, this.animationDuration * 1100);

        const movementAnimation = (target: cc.Node, movement: cc.Vec2) => {
            cc.tween(target)
                .by(this.animationDuration, {position: cc.v3(movement)}, {easing: 'smooth'})
                .call(this.renderChessman.bind(this))
                .start();
        };

        const turn = e.target.name[0] === "L" ? Turn.Left : Turn.Right;
        const col = Number(e.target.name.substr(1));
        this.chessBoard.move(turn, col, {type: this.generateNextChessman(), data: ""});

        for (let change of this.chessBoard.chessboardChanges) {
            let l = change.lCol, r = change.rCol;
            let target: cc.Node | null = null;

            if (change.type !== ChessboardChangeType.Spawn) {
                target = this.chessmanNode!.getChildByName(GameScene.getNameFromLoc(l, r));
                if (!target) continue;
            }

            switch (change.type) {
                case ChessboardChangeType.Left:
                    // noinspection JSSuspiciousNameCombination
                    movementAnimation(target!, cc.v2(0, this.gridWidth));
                    break;
                case ChessboardChangeType.Right:
                    movementAnimation(target!, cc.v2(this.gridWidth, 0));
                    break;
                case ChessboardChangeType.Spawn: {
                    let target = this.generateChessmanNode(+change.target, l, r);
                    if (target === null) break;
                    target.opacity = 0;
                    cc.tween(target)
                        .to(this.animationDuration, {opacity: 255}, {easing: 'smooth'})
                        .start();
                    break;
                }
                case ChessboardChangeType.Despawn: {
                    cc.tween(target!)
                        .to(this.animationDuration, {opacity: 0}, {easing: 'smooth'})
                        .call(this.renderChessman.bind(this))
                        .start();
                    break;
                }
            }
        }
        this.chessBoard.chessboardChanges = [];
        if (this.chessBoard.chessboardSizeChanged) {
            this.buildChessboard();
            this.chessBoard.chessboardSizeChanged = false;
        }
    }

    private onEjectorLeave(e: EventTouch) {
        clearTimeout(this.touchTimeout);
        this.touchTimeout = 0;
    }

    public buildChessboard(): void {
        let drawLCol = maxCol + 1, drawRCol = maxCol + 1; // Number of grids including ejectors

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
                } else {
                    if ((l + r) % 2 == 0) {
                        grid.spriteFrame = this.grid1SpriteFrame;
                    } else {
                        grid.spriteFrame = this.grid2SpriteFrame;
                    }
                    gridNode.name = GameScene.getNameFromLoc(l, r);
                }

                if (ejector) {
                    gridNode.on(cc.Node.EventType.TOUCH_START, this.onEjectorClicked, this);
                    gridNode.on(cc.Node.EventType.TOUCH_END, this.onEjectorLeave, this);
                }
                if (l > this.lCol || r > this.rCol) gridNode.opacity = 0;

                gridNode.scale = scale;
                gridNode.setPosition(l * this.gridWidth, r * this.gridWidth);

                this.gridNode.addChild(gridNode);
            }
        }
        this.chessmanNode = new cc.Node();
        this.gridNode.addChild(this.chessmanNode);
        this.renderChessman();
    }

    private static getNameFromLoc(lCol: number, rCol: number): string {
        return lCol.toString() + "," + rCol.toString()
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

    public renderChessman() {
        let chessmenNode = this.chessmanNode!;
        chessmenNode.removeAllChildren();
        for (let l = 0; l < this.lCol; l++) {
            for (let r = 0; r < this.rCol; r++) {
                this.generateChessmanNode(this.chessBoard.getChess(l, r).type, l, r)
            }
        }
        this.boardBusy = false;
    }
}