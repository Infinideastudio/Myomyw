/*继承后重载下面的函数:
onBeganMoving(col, last) 开始移动后调用,col为移动列号,last为移出去的球
onEndedMoving(col, last) 结束移动后调用,col为移动列号,last为移出去的球
onChangedTurn() 切换回合后调用
onWin(timeout) 胜利后调用 胜利方为this.turn的反方 timeout表示是否由于超时
*/
var GameScene = cc.Scene.extend({
    lCol: defaultLCol,
    rCol: defaultRCol,
    chessmen: null,
    createNextChessman: null,
    nextChessman: null,
    turn: null,
    playing: false,
    totalMovements: null,
    action: Action.nothing,
    controllableSide: null,
    moveByTouching: false,
    touching: false,
    enableTimer: false,
    //TID = Timeout ID
    coolTID: null,
    timerTID: null,
    handleMovingEndTID: null,
    //TFN = Timeout function
    handleMovingEndTFN: null,

    boardLength: null,
    halfDiagonal: null,
    diagonal: null,
    topVertX: null, //棋盘上面的顶点的x坐标(这可以表示很多东西)

    board: null,
    gridNode: null,
    border: null,
    stencilDrawNode: null,
    stencil: null,
    chessmanNode: null,
    leftNameLabel: null,
    rightNameLabel: null,
    timerStencil: null,
    timerStencilDrawNode: null,
    timer: null,
    /*
    leftName 左边玩家的名字
    rightName 右边玩家的名字
    controllableSide 可控制的方向(left, right, both, neither)
    createNextChessman 设置获取下一个棋子的函数(设为null则需要手动调用setNextChessman)
    enableTimer 是否开启限时
    */
    ctor: function (leftName, rightName, controllableSide, createNextChessman, enableTimer) {
        this._super();
        this.chessmen = new Array();
        for (var i = 0; i < maxLCol; i++) {
            this.chessmen[i] = new Array();
            for (var j = 0; j < maxRCol; j++) {
                this.chessmen[i][j] = Chessman.common;
            }
        }
        var backButton = new ccui.Button(res.BackButtonN_png, res.BackButtonS_png);
        backButton.setPosition(backButton.width / 2 + 10, backButton.height / 2 + 10);
        backButton.addClickEventListener(function () {
            cc.director.runScene(new MainScene());
        });
        this.addChild(backButton, 10);

        this.boardLength = Math.min(size.width, size.height) - 10;
        this.board = new cc.Layer();
        this.board.ignoreAnchorPointForPosition(false);
        this.board.attr({
            width: this.boardLength,
            height: this.boardLength,
            x: size.width / 2,
            y: size.height / 2
        });
        this.addChild(this.board);

        this.gridNode = new cc.Node();
        this.board.addChild(this.gridNode, 0);
        this.border = new cc.DrawNode();
        this.board.addChild(this.border, 2);

        this.stencilDrawNode = new cc.DrawNode();
        this.stencil = new cc.ClippingNode(this.stencilDrawNode);
        this.board.addChild(this.stencil, 1);
        this.chessmanNode = new cc.Node();
        this.stencil.addChild(this.chessmanNode);

        this.createNextChessman = createNextChessman;
        this.controllableSide = controllableSide;
        this.enableTimer = enableTimer || false;
        if (this.enableTimer) {
            this.timerStencilDrawNode = new cc.DrawNode();
            this.timerStencil = new cc.ClippingNode(this.timerStencilDrawNode);
            this.board.addChild(this.timerStencil);

            this.timer = new cc.LayerColor(cc.color(255, 255, 255, 100));
            this.timer.ignoreAnchorPointForPosition(false);
            this.timer.setAnchorPoint(0.5, 1);
            this.timerStencil.addChild(this.timer);
        }

        this.leftNameLabel = creator.createLabel(leftName, 25);
        this.leftNameLabel.setPosition(this.leftNameLabel.width / 2 + 20, size.height - this.leftNameLabel.height / 2 - 20);
        this.addChild(this.leftNameLabel);
        this.rightNameLabel = creator.createLabel(rightName, 25);
        this.rightNameLabel.setPosition(size.width - this.rightNameLabel.width / 2 - 20, size.height - this.rightNameLabel.height / 2 - 20);
        this.addChild(this.rightNameLabel);

        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            onTouchBegan: this.ejectorTouchBegan.bind(this),
            onTouchEnded: this.ejectorTouchEnded.bind(this)
        }, this.board);

        this.buildChessboard()

        return true;
    },

    ejectorTouchBegan: function (touch, event) {
        if (this.controllableSide != both && this.controllableSide != this.turn) return false;
        if (!this.playing || this.action == Action.moving) return false;
        for (var i = 0; i < (this.turn == left ? this.lCol : this.rCol) ; i++) {
            var ejector = this.gridNode.getChildByTag(this.turn == left ? i : this.lCol + i);
            if (!ejector) continue;
            var point = this.board.convertTouchToNodeSpace(touch);
            point = cc.p(point.x - ejector.x, point.y - ejector.y);
            if (point.x + point.y < this.halfDiagonal &&
                point.x + point.y > -this.halfDiagonal &&
                point.x - point.y > -this.halfDiagonal &&
                point.y - point.x > -this.halfDiagonal) {
                this.moveByTouching = true;
                this.touching = true;
                this.move(i);
                return true;
            }
        }
        return false;
    },

    ejectorTouchEnded: function (touch, event) {
        if (this.touching) {
            this.touching = false;
            if (this.action == Action.cooling) {
                clearTimeout(this.coolTID);
                this.changeTurn();
            }
        }
    },

    start: function (side) {
        this.playing = true;
        this.setTurn(side);
        if (this.createNextChessman) {
            this.setNextChessman(this.createNextChessman());
        }
        if (this.enableTimer) {
            this.startTimer();
        }
    },

    setNextChessman: function (chessman) {
        this.nextChessman = chessman;
        var moveAction = cc.moveBy(0.5, cc.p(0, -20));
        var old = this.getChildByName("next");
        if (old) {
            old.setName("");
            var fadeOutAction = cc.fadeOut(0.5);
            old.runAction(moveAction);
            old.runAction(fadeOutAction);
            setTimeout(this.removeChild.bind(this, old), 5000);
        }

        var nextChessmanSprite = this.createSpriteByChessman(this.nextChessman);
        nextChessmanSprite.attr({
            opacity: 0,
            scale: 0.8,
            x: size.width - 50,
            y: size.height - 80
        });
        nextChessmanSprite.setName("next");
        var fadeInAction = cc.fadeIn(0.5);
        nextChessmanSprite.runAction(moveAction.clone());
        nextChessmanSprite.runAction(fadeInAction);
        this.addChild(nextChessmanSprite);
    },

    createSpriteByChessman: function (type) {
        var chessman = new cc.Sprite(chessmanTex[type]);
        chessman.scaleX = this.halfDiagonal / chessman.width;
        chessman.scaleY = this.halfDiagonal / chessman.height;
        return chessman;
    },

    buildChessboard: function () {
        var drawLCol = this.lCol + 1, drawRCol = this.rCol + 1; //画图时的网格数量(加上发射器)
        this.halfDiagonal = this.boardLength / (drawLCol + drawRCol);
        this.diagonal = 2 * this.halfDiagonal;
        this.topVertX = drawLCol * this.halfDiagonal;
        this.stencilDrawNode.clear();
        //遮罩不包括发射器部分
        var stencilPoly = [
            cc.p(this.topVertX, this.boardLength - this.diagonal),
            cc.p(this.halfDiagonal, this.boardLength - this.topVertX - this.halfDiagonal),
            cc.p(this.boardLength - this.topVertX, 0),
            cc.p(this.boardLength - this.halfDiagonal, this.topVertX - this.halfDiagonal)
        ];
        this.stencilDrawNode.drawPoly(stencilPoly, cc.color(255, 255, 255), 0, cc.color(255, 255, 255));

        //网格(包括背景网格和发射器)
        this.gridNode.removeAllChildren();
        var ejectorScale; //所有Grid目录下的贴图应该有相同的分辨率,且长宽相同
        for (var l = 0; l < drawLCol; l++) {
            for (var r = 0; r < drawRCol; r++) {
                var grid;
                if (l == 0 && r == 0) {
                    continue;
                }
                else if (r == 0) {
                    grid = new cc.Sprite(res.GreenEjector_png);
                    grid.tag = l - 1;
                }
                else if (l == 0) {
                    grid = new cc.Sprite(res.BlueEjector_png);
                    grid.tag = this.lCol + r - 1;
                }
                else if ((l + r) % 2 == 0) {
                    grid = new cc.Sprite(res.Grid1_png);
                }
                else {
                    grid = new cc.Sprite(res.Grid2_png);
                }

                if (!ejectorScale) {
                    ejectorScale = this.diagonal / Math.sqrt(2 * grid.width * grid.width);
                }
                grid.attr({
                    rotation: 45,
                    scale: ejectorScale,
                    x: (r - l) * this.halfDiagonal + this.topVertX,
                    y: this.boardLength - (l + r + 1) * this.halfDiagonal
                });
                this.gridNode.addChild(grid);
            }
        }
        //边框线
        this.border.clear();
        for (var i = 0; i <= drawLCol; i++) {
            this.border.drawSegment(cc.p(this.topVertX - this.halfDiagonal * i, this.boardLength - this.halfDiagonal * i),
                i > 1 && i < drawLCol ?
                cc.p(this.topVertX - this.halfDiagonal * (i - 1), this.boardLength - this.halfDiagonal * (i + 1)) :
                cc.p(this.topVertX - this.halfDiagonal * (i - drawRCol), this.boardLength - this.halfDiagonal * (i + drawRCol)),
                1, cc.color(128, 128, 128));
        }
        for (var i = 0; i <= drawRCol; i++) {
            this.border.drawSegment(cc.p(this.topVertX + this.halfDiagonal * i, this.boardLength - this.halfDiagonal * i),
                i > 1 && i < drawRCol ?
                cc.p(this.topVertX + this.halfDiagonal * (i - 1), this.boardLength - this.halfDiagonal * (i + 1)) :
                cc.p(this.topVertX + this.halfDiagonal * (i - drawLCol), this.boardLength - this.halfDiagonal * (i + drawLCol)),
               1, cc.color(128, 128, 128));
        }

        if (this.enableTimer) {
            this.timerStencilDrawNode.clear();
            var timerStencilPoly = [
                cc.p(this.topVertX, this.boardLength),
                cc.p(this.topVertX - this.halfDiagonal, this.boardLength - this.halfDiagonal),
                cc.p(this.topVertX, this.boardLength - this.diagonal),
                cc.p(this.topVertX + this.halfDiagonal, this.boardLength - this.halfDiagonal)
            ];
            this.timerStencilDrawNode.drawPoly(timerStencilPoly, cc.color(255, 255, 255), 0, cc.color(255, 255, 255));
        }

        this.setTurnFlag();
        this.updateChessboard();
    },

    updateChessboard: function () {
        this.chessmanNode.removeAllChildren();
        for (var l = 0; l < this.lCol; l++) {
            for (var r = 0; r < this.rCol; r++) {
                var chessman = this.createSpriteByChessman(this.chessmen[l][r]);
                chessman.setPosition((r - l) * this.halfDiagonal + this.topVertX,
                    this.boardLength - (l + r + 3) * this.halfDiagonal);
                chessman.setTag(l * this.rCol + r);
                this.chessmanNode.addChild(chessman);
            }
        }
    },

    setTurnFlag: function () {
        var leftOpacity = this.turn == left ? 255 : 150;
        var rightOpacity = this.turn == right ? 255 : 150;
        for (var i = 0; i < this.lCol; i++) {
            this.gridNode.getChildByTag(i).setOpacity(leftOpacity);
        }
        for (var i = 0; i < this.rCol; i++) {
            this.gridNode.getChildByTag(this.lCol + i).setOpacity(rightOpacity);
        }

        this.leftNameLabel.color = this.turn == left ? cc.color(0, 200, 0) : cc.color(0, 0, 0);
        this.rightNameLabel.color = this.turn == right ? cc.color(0, 0, 200) : cc.color(0, 0, 0);

        if (this.turn != null) {
            var scaleAction = cc.scaleTo(0.2, 1.2);
            var resetAction = cc.scaleTo(0.2, 1.0);
            this.leftNameLabel.runAction(this.turn == left ? scaleAction : resetAction);
            this.rightNameLabel.runAction(this.turn == right ? scaleAction : resetAction);
            if (this.enableTimer) {
                this.timer.color = this.turn == left ? cc.color(0, 255, 0) : cc.color(0, 100, 255);
            }
        }
    },

    setTurn: function (turn) {
        this.turn = turn;
        this.totalMovements = 0;
        this.touching = false;
        this.moveByTouching = false;
        this.action = Action.nothing;
        this.setTurnFlag();
    },

    changeTurn: function () {
        this.setTurn(this.turn == left ? right : left);
        if (this.enableTimer) {
            this.startTimer();
        }
        this.onChangedTurn();
    },

    move: function (col) {
        if (this.playing && this.action != Action.moving) {
            if (this.enableTimer) {
                this.stopTimer();
            }
            this.action = Action.moving;
            this.totalMovements++;
            var lastChessman; //暂存最底下的棋子
            if (this.turn == left) {
                lastChessman = this.chessmen[col][this.rCol - 1];
                for (var i = this.rCol - 1; i > 0; i--) {
                    this.chessmen[col][i] = this.chessmen[col][i - 1];
                }
                this.chessmen[col][0] = this.nextChessman;
            }
            else {
                lastChessman = this.chessmen[this.lCol - 1][col];
                for (var i = this.lCol - 1; i > 0; i--) {
                    this.chessmen[i][col] = this.chessmen[i - 1][col];
                }
                this.chessmen[0][col] = this.nextChessman;
            }

            //移动动画
            var newChessman = this.createSpriteByChessman(this.nextChessman);
            newChessman.setPosition(
                this.halfDiagonal * (this.turn == left ? -col - 1 : col + 1) + this.topVertX,
                this.boardLength - this.halfDiagonal * (col + 2));
            this.chessmanNode.addChild(newChessman);
            var movingAction = cc.moveBy(0.3,
                cc.p(this.turn == left ? this.halfDiagonal : -this.halfDiagonal, -this.halfDiagonal));
            newChessman.runAction(movingAction);
            for (var i = 0; i < (this.turn == left ? this.rCol : this.lCol) ; i++) {
                this.chessmanNode.getChildByTag(
                    this.turn == left ? col * this.rCol + i : i * this.rCol + col).runAction(movingAction.clone());
            }

            var func = this.handleMovingEnd.bind(this, col, lastChessman);
            this.handleMovingEndTFN = func;
            this.handleMovingEndTID = setTimeout(func, 300);

            if (this.createNextChessman) {
                this.setNextChessman(this.createNextChessman());
            }
            this.onBeganMoving(col, lastChessman);
        }
    },

    coolAndMove: function (col) {
        this.coolTID = setTimeout(this.move.bind(this, col), 400);
    },

    //移动结束后的处理
    handleMovingEnd: function (col, lastChessman) {
        switch (lastChessman) {
            case Chessman.key:
                this.updateChessboard();
                this.playing = false;
                this.onWin(false);
                return;
            case Chessman.addCol:
                if (this.turn == left)
                    this.setBoardSize(this.lCol, this.rCol + 1);
                else
                    this.setBoardSize(this.lCol + 1, this.rCol);
                break;
            case Chessman.delCol:
                if (this.turn == left)
                    this.setBoardSize(this.lCol, this.rCol - 1);
                else
                    this.setBoardSize(this.lCol - 1, this.rCol);
                break;
            case Chessman.flip:
                this.flip();
                this.changeTurn();
                break;
            default:
                this.updateChessboard();
                break;
        }
        this.onEndedMoving(col, lastChessman);
        if (this.moveByTouching) {
            if (this.touching && this.totalMovements < maxMovements) {
                this.coolAndMove(col);
                this.action = Action.cooling;
            }
            else {
                this.changeTurn();
            }
        }
        else {
            this.action = Action.nothing;
        }
    },

    endMovingAtOnce: function () {
        var allChessmen = this.chessmanNode.getChildren();
        for (var i = 0; i < allChessmen.length; i++) {
            allChessmen[i].stopAllActions();
        }
        clearTimeout(this.handleMovingEndTID);
        this.handleMovingEndTFN();
        this.handleMovingEndTFN = null;
    },

    setBoardSize: function (lCol, rCol) {
        if (lCol <= maxLCol && lCol >= minLCol && rCol <= maxRCol && rCol >= minRCol) {
            //如果棋盘变大，把多出来的部分设置为普通球
            if (this.lCol < lCol) {
                for (var l = this.lCol; l < lCol; l++) {
                    for (var r = 0; r < rCol; r++) {
                        this.chessmen[l][r] = Chessman.common;
                    }
                }
            }
            if (this.rCol < rCol) {
                for (var l = 0; l < lCol; l++) {
                    for (var r = this.rCol; r < rCol; r++) {
                        this.chessmen[l][r] = Chessman.common;
                    }
                }
            }

            this.board.setScale((lCol + rCol) / (this.lCol + this.rCol));
            var scaleAction = cc.scaleTo(0.2, 1);
            this.board.runAction(scaleAction);
            this.lCol = lCol;
            this.rCol = rCol;
            this.buildChessboard();
        }
        else {
            this.updateChessboard();
        }
    },

    flip: function () {
        for (var l = 0; l < maxLCol; l++) {
            for (var r = l + 1; r < maxRCol; r++) {
                this.chessmen[l][r] ^= this.chessmen[r][l];
                this.chessmen[r][l] ^= this.chessmen[l][r];
                this.chessmen[l][r] ^= this.chessmen[r][l];
            }
        }
        this.lCol ^= this.rCol;
        this.rCol ^= this.lCol;
        this.lCol ^= this.rCol;

        var scaleAction1 = cc.scaleTo(0.2, 0, 1);
        var callAction = cc.callFunc(this.buildChessboard.bind(this));
        var scaleAction2 = cc.scaleTo(0.2, 1);
        var sequenceAction = cc.sequence(scaleAction1, callAction, scaleAction2);
        this.board.runAction(sequenceAction);
    },

    startTimer: function () {
        this.stopTimer();
        this.timer.setPosition(this.topVertX, this.boardLength);
        var moveAction = cc.moveBy(20, cc.p(0, -this.diagonal));
        this.timer.runAction(moveAction);
        this.timerTID = setTimeout(function () {
            this.playing = false;
            this.onWin(true);
        }.bind(this), 20000);
    },

    stopTimer: function () {
        this.timer.stopAllActions();
        clearTimeout(this.timerTID);
    },

    onBeganMoving: function (col, last) { },

    onEndedMoving: function (col, last) { },

    onChangedTurn: function () { },

    onWin: function (timeout) { }
});
