var DoubleGameScene = GameScene.extend({
    ctor: function () {
        this._super(txt.names.left, txt.names.right, both, getRandomChessman,
            storage.getItem("standaloneTimer") != "false");

        var label = creator.createLabel(txt.mainScene.playDouble, 25);
        label.setPosition(225, 680);
        this.sideBar.addChild(label);

        var mainTitle = new cc.Sprite(res.Title_png);
        mainTitle.setPosition(225, 200);
        mainTitle.scale = 0.5;
        this.sideBar.addChild(mainTitle);

        this.start(left);
        return true;
    },

    onWin: function (timeout) {
        var str = "";
        var color;
        if (timeout) {
            if (this.turn == left)
                str = txt.result.leftOutOfTime;
            else
                str = txt.result.rightOutOfTime;
            str += "\n";
        }
        if (this.turn == left) {
            str += txt.result.rightWins;
            color = cc.color(0, 100, 255);
        }
        else {
            str += txt.result.leftWins;
            color = cc.color(0, 255, 0);
        }
        this.showExitModalBox = false;
        this.addChild(new ResultLayer(str, color));
        this.exitModalBox.hide();
    }
});
