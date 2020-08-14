import EventTouch = cc.Event.EventTouch;

const {ccclass, property} = cc._decorator;

@ccclass
export class GameScene extends cc.Component {
    lCol: number = 5;
    rCol: number = 5;
    boardLength: number = 500;

    @property(cc.Node)
    gridNode: cc.Node = new cc.Node();
    @property(cc.SpriteFrame)
    greenEjectorSpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    blueEjectorSpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    grid1SpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();
    @property(cc.SpriteFrame)
    grid2SpriteFrame: cc.SpriteFrame = new cc.SpriteFrame();

    get halfDiagonal(): number {
        return this.boardLength / (this.lCol + this.rCol + 2);
    }

    public onLoad(): void {
        this.buildChessboard();
    }

    private onEjectorClicked(e: EventTouch) {
        console.log(e.target.name);
    }

    private onEjectorLeave(e: EventTouch) {
        console.log(e.target.name);
    }

    public buildChessboard(): void {
        let drawLCol = this.lCol + 1, drawRCol = this.rCol + 1; // Number of grids including ejectors

        // Grids (including ejectors)
        this.gridNode.removeAllChildren();
        const gridWidth = this.grid1SpriteFrame.getOriginalSize().width;
        const scale = 2 * this.halfDiagonal / Math.sqrt(2 * gridWidth * gridWidth);

        for (let l = 0; l < drawLCol; l++) {
            for (let r = 0; r < drawRCol; r++) {
                let gridNode = new cc.Node();
                let grid = gridNode.addComponent(cc.Sprite);
                let ejector = false;
                if (l == 0 && r == 0) {
                    continue;
                } else if (r == 0) {
                    grid.spriteFrame = this.greenEjectorSpriteFrame;
                    gridNode.name = (l - 1).toString();
                    ejector = true;
                } else if (l == 0) {
                    grid.spriteFrame = this.blueEjectorSpriteFrame;
                    gridNode.name = (this.lCol + r - 1).toString();
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
                gridNode.x = l * gridWidth;//(r - l) * this.halfDiagonal + topVertX;
                gridNode.y = r * gridWidth;//this.boardLength - (l + r + 1) * this.halfDiagonal;

                this.gridNode.addChild(gridNode);
            }
        }
    }
}