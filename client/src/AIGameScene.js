var AIGameScene = GameScene.extend({
    ai1: null,
    ai2: null,

    ctor: function (ai1, ai2, info, quick) {
        this._super(ai1 ? ai1.name : storage.getItem("name"), ai1 ? ai2.name : txt.names.ai, ai1 ? neither : left, getRandomChessman,
            storage.getItem("standaloneTimer") != "false");
        this.ai1 = ai1;
        this.ai2 = ai2;
        this.quick = quick;

        var title = txt.mainScene.playWithAI + " - " + info;
        if (ai1) title = "AI vs AI";
        var label = creator.createLabel(title, 25);
        label.setPosition(225, 680);
        this.sideBar.addChild(label);

        var mainTitle = new cc.Sprite(res.Title_png);
        mainTitle.setPosition(225, 200);
        mainTitle.scale = 0.5;
        this.sideBar.addChild(mainTitle);
        if (quick) {
            this.ttime = time;
            time = {
                movingTime: 0.05,
                coolingTime: 0.05,
                timeLimit: 20,
                scalingTime: 0.05,
                flippingTime: 0.05,
                aiThinkingTime: 0
            }
        }
        this.start(left);
        if (this.ai1) {
            setTimeout(this.aiMove.bind(this), time.aiThinkingTime * 1000);
        }
        return true;
    },
    onExit: function () {
        if (this.quick) {
            time = this.ttime;
        }
    },
    onEndedMoving: function (col, last) {
        if ((this.turn == right || this.ai1) && last != Chessman.flip) {
            var currentAI = (this.turn == left ? this.ai1 : this.ai2);
            if (currentAI.continue(this.nextChessman)) {
                this.coolAndMove(col);
            }
            else {
                this.changeTurn();
            }
        }
    },

    onChangedTurn: function () {
        if (this.turn == right || this.ai1) {
            setTimeout(this.aiMove.bind(this), time.aiThinkingTime * 1000);
        }
    },

    aiMove: function () {
        var gameNode = new GameNode(this.chessmen, this.lCol, this.rCol);
        if (this.turn == right) {
            gameNode.flip();
        }
        var currentAI = (this.turn == left ? this.ai1 : this.ai2);
        currentAI.loadGame(gameNode);
        this.move(currentAI.firstMove(this.nextChessman));
    },

    onWin: function (timeout) {
        var str = "";
        if (timeout) {
            if (this.turn == left)
                str = (this.ai1 ? txt.result.leftOutOfTime : txt.result.youOutOfTime);
            else
                str = (this.ai1 ? txt.result.rightOutOfTime : txt.result.aiOutOfTime);
            str += "\n";
        }
        if (this.turn == left)
            str += (this.ai1 ? txt.result.rightWins : txt.result.aiWins);
        else
            str += (this.ai1 ? txt.result.leftWins : txt.result.youWin);
        this.showExitModalBox = false;
        this.addChild(new ResultLayer(str, cc.color(0, 0, 0)));
    }
});
