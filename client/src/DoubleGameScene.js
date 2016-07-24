var DoubleGameScene = GameScene.extend({
    ctor: function () {
        this._super(txt.names.left, txt.names.right, both, getRandomChessman,
            storage.getItem("standaloneTimer") != "false");
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
            str += txt.result.rightWins;
            color = cc.color(0, 255, 0);
        }
        this.addChild(new ResultLayer(str, color));
    }
});
