var TutorialGameScene = GameScene.extend({
    step: 0,
    firstNewChessman: true,
    tutorialLabel: null,

    ctor: function () {
        this._super(player.name, txt.names.ai, left, this.createNewChessman.bind(this), true);
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            onTouchBegan: this.touched.bind(this)
        }, this);
        this.tutorialLabel = creator.createLabel("", 20);
        this.changeText(txt.tutorial.s0);
        this.addChild(this.tutorialLabel);
        return true;
    },

    createNewChessman: function () {
        if (this.firstNewChessman) {
            this.firstNewChessman = false;
            return Chessman.key;
        }
        else {
            return Chessman.common;
        }
    },

    touched: function () {
        switch (this.step) {
            case 0:
                this.step++;
                this.changeText(txt.tutorial.s1);
                this.start(left);
                break;
            case 2:
                this.step++;
                this.changeText(txt.tutorial.s3);
                this.chessmen[3][1] = Chessman.addCol;
                this.chessmen[1][3] = Chessman.delCol;
                this.updateChessboard();
                break;
            case 3:
                this.step++;
                this.changeText(txt.tutorial.s4);
                this.chessmen[3][3] = Chessman.flip;
                this.updateChessboard();
                break;
            case 4:
                this.step++;
                this.changeText(txt.tutorial.s5);
                break;
            case 5:
                cc.director.runScene(new MainScene());
                break;
        }
    },

    changeText: function (text) {
        this.tutorialLabel.string = text;
        this.tutorialLabel.setPosition(this.tutorialLabel.width / 2 + 10,
            size.height - this.tutorialLabel.height / 2 - 60);
    },

    onChangedTurn: function () {
        if (this.step == 1) {
            this.step++;
            this.changeText(txt.tutorial.s2);
            this.stopTimer();
        }
    },

    onWin:function(timeout){
        if (this.turn == left && timeout) {
            this.addChild(new ResultLayer(txt.result.youOutOfTime, cc.color(0, 0, 0)));
        }
    }
});
