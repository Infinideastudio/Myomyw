var AIGameScene = GameScene.extend({
    aiMovements: null, //null代表不在移动,0代表刚移动完

    ctor: function () {
        this._super(storage.getItem("name"), txt.names.ai, left, getRandomChessman,
            storage.getItem("standaloneTimer") != "false");
        this.start(left);
        return true;
    },

    onBeganMoving: function (col, last) {
        if (last == Chessman.flip) {
            this.aiMovements = null;
        }
    },

    onEndedMoving: function (col, last) {
        if (this.aiMovements > 0) {
            this.aiMovements--;
            this.coolAndMove(col);
        }
        else if (this.aiMovements == 0) {
            this.changeTurn();
            this.aiMovements = null;
        }
    },

    onChangedTurn: function () {
        if (this.turn == right) {
            //切换回合后冷却一下再让AI下(否则看起来太突然)
            setTimeout(this.aiMove.bind(this), aiThinkingTime * 1000);
        }
    },

    aiMove: function () {
        var maxWeighting = -100;
        var bestCol = 0;
        for (var r = 0; r < this.rCol; r++) {
            var weighting = 0;
            for (var l = 0; l < this.lCol; l++) {
                var change = 0;
                switch (this.chessmen[l][r]) {
                    case Chessman.common:
                        change = 1;
                        break;
                    case Chessman.key:
                        //对最下面一列的红球给予特别特别关注
                        if (l == this.lCol - 1)
                            change = -10;
                        else
                            change = -3;
                        break;
                    case Chessman.addCol:
                        change = -1;
                        break;
                    case Chessman.delCol:
                        change = 2;
                        break;
                    case Chessman.filp:
                        if (this.lCol > this.rCol)
                            change = 1;
                        else
                            change = -1;
                }
                //离出口越近权重越大
                weighting += change * ((l + 1) / this.lCol);
            }
            if (weighting > maxWeighting) {
                maxWeighting = weighting;
                bestCol = r;
            }
        }

        //移动次数根据权重而变
        var times = Math.round(maxWeighting);
        //确定实际移动次数
        if (times < 1) {
            this.aiMovements = 1;
        }
        else if (times > maxMovements) {
            this.aiMovements = maxMovements;
        }
        else {
            this.aiMovements = times;
        }
        this.move(bestCol);
        this.aiMovements--;
    },

    onWin: function (timeout) {
        var str = "";
        if (timeout) {
            if (this.turn == left)
                str = txt.result.youOutOfTime;
            else
                str = txt.result.aiOutOfTime;
            str += "\n";
        }
        if (this.turn == left)
            str += txt.result.aiWins;
        else
            str += txt.result.youWin;
        this.gameEnded = true;
        this.addChild(new ResultLayer(str, cc.color(0, 0, 0)));
    }
});
