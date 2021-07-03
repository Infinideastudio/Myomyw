function GameNode(chessmen, lCol, rCol) {
    this.lCol = lCol;
    this.rCol = rCol;
    this.chessmen = [];
    for (var i = 0; i < maxLCol; i++) {
        this.chessmen[i] = [];
        for (var j = 0; j < maxRCol; j++) {
            this.chessmen[i][j] = chessmen[i][j];
        }
    }
}

GameNode.prototype.moveOnce = function (side, col, nextChessman) {
    var lastChessman;
    if (side == left) {
        lastChessman = this.chessmen[col][this.rCol - 1];
        for (var i = this.rCol - 1; i > 0; i--) {
            this.chessmen[col][i] = this.chessmen[col][i - 1];
        }
        this.chessmen[col][0] = nextChessman;
    }
    else {
        lastChessman = this.chessmen[this.lCol - 1][col];
        for (var i = this.lCol - 1; i > 0; i--) {
            this.chessmen[i][col] = this.chessmen[i - 1][col];
        }
        this.chessmen[0][col] = nextChessman;
    }
    if (lastChessman == Chessman.addCol) {
        if (side == left)
            this.setBoardSize(this.lCol, Math.min(this.rCol + 1, maxRCol));
        else
            this.setBoardSize(Math.min(this.lCol + 1, maxLCol), this.rCol);
    } else if (lastChessman == Chessman.delCol) {
        if (side == left)
            this.setBoardSize(this.lCol, Math.max(this.rCol - 1, minRCol));
        else
            this.setBoardSize(Math.max(this.lCol - 1, minLCol), this.rCol);
    } else if (lastChessman == Chessman.flip) {
        this.flip();
    }
    return lastChessman;
}

GameNode.prototype.setBoardSize = function (lCol, rCol) {
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
    this.lCol = lCol;
    this.rCol = rCol;
}
GameNode.prototype.flip = function () {
    for (var l = 0; l < maxLCol; l++) {
        for (var r = l + 1; r < maxRCol; r++) {
            var temp = this.chessmen[l][r];
            this.chessmen[l][r] = this.chessmen[r][l];
            this.chessmen[r][l] = temp;
        }
    }
    var temp = this.rCol;
    this.rCol = this.lCol;
    this.lCol = temp;
}