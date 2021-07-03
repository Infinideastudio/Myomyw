//AI为左方
function AI() { 
    this.name = txt.names.ai;
}
AI.prototype.loadGame = function (gameNode) {
    this.gameNode = gameNode;
    var maxWeighting = -100;
    this.bestCol = 0;
    for (var l = 0; l < gameNode.lCol; l++) {
        var weighting = 0;
        for (var r = 0; r < gameNode.rCol; r++) {
            var change = 0;
            switch (gameNode.chessmen[l][r]) {
                case Chessman.common:
                    change = 1;
                    break;
                case Chessman.key:
                    //对最下面一列的红球给予特别特别关注
                    if (r == gameNode.rCol - 1)
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
                    if (gameNode.rCol > gameNode.lCol)
                        change = 1;
                    else
                        change = -1;
            }
            //离出口越近权重越大
            weighting += change * ((r + 1) / gameNode.rCol);
        }
        if (weighting > maxWeighting) {
            maxWeighting = weighting;
            this.bestCol = l;
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
}

AI.prototype.firstMove = function (nextChessman) {
    this.aiMovements--;
    if (this.gameNode.moveOnce(left, this.bestCol, nextChessman) == Chessman.flip)
        this.aiMovements = 0;
    return this.bestCol;
}

AI.prototype.continue = function (nextChessman) {
    if (this.aiMovements > 0) {
        this.aiMovements--;
        if (this.gameNode.moveOnce(left, this.bestCol, nextChessman) == Chessman.flip)
            this.aiMovements = 0;
        return true;
    }
    else {
        return false;
    }
}
