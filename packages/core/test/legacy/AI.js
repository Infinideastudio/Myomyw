//AI为左方
function WeakAI() {
    this.name = "WeakAI";
}
WeakAI.prototype.loadGame = function (gameNode) {
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

WeakAI.prototype.firstMove = function (nextChessman) {
    this.aiMovements--;
    if (this.gameNode.moveOnce(left, this.bestCol, nextChessman) == Chessman.flip)
        this.aiMovements = 0;
    return this.bestCol;
}

WeakAI.prototype.continue = function (nextChessman) {
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

function StrongAI(maxDepth, fillout) {
    this.name = "StrongAI(maxDepth:" + maxDepth + ",fillout:" + fillout + ")";
    this.maxDepth = maxDepth;
    this.fillout = fillout;
}
StrongAI.prototype.loadGame = function (gameNode) {
    this.root = gameNode;
}

StrongAI.prototype.firstMove = function (nextChessman) {
    var colValue = [];
    for (var l = 0; l < this.root.lCol; l++) {
        colValue[l] = 0;
    }
    this.pool = [nextChessman];
    for (var i = 0; i < this.fillout; i++) {
        var weight = this.fillPool(1, this.maxDepth * maxMovements - 1);
        for (var l = 0; l < this.root.lCol; l++) {
            colValue[l] += weight * this.searchCol(this.root, this.maxDepth, -Infinity, Infinity, left, 0, l, -Infinity);
        }
    }
    var bestValue = -Infinity, bestCol;
    for (var l = 0; l < this.root.lCol; l++) {
        if (colValue[l] > bestValue) {
            bestValue = colValue[l];
            bestCol = l;
        }
    }
    this.root.moveOnce(left, bestCol, nextChessman);
    this.moved = 1;
    this.currentCol = bestCol;
    return bestCol;
}

StrongAI.prototype.continue = function (nextChessman) {
    var maxmove = maxMovements - this.moved;
    if (maxmove == 0) return false;
    var moveValue = [];
    for (var i = 0; i <= maxmove; i++) {
        moveValue[i] = 0;
    }
    this.pool = [nextChessman];
    for (var i = 0; i < this.maxDepth; i++) {
        var weight = this.fillPool(1, (this.maxDepth - 1) * maxMovements - 1 + maxmove);
        var poolptr = 0;
        var newnode = new GameNode(this.root.chessmen, this.root.lCol, this.root.rCol);
        moveValue[0] -= weight * this.search(newnode, 1, -Infinity, Infinity, right, poolptr);
        for (var m = 1; m <= maxmove; m++) {
            var last = newnode.moveOnce(left, this.currentCol, this.pool[poolptr++]);
            if (last == Chessman.key) {
                maxmove = m - 1;
                break;
            }
            moveValue[m] -= weight * this.search(newnode, this.maxDepth - 1, -Infinity, Infinity, right, poolptr);
            if (last == Chessman.flip) {
                maxmove = m;
                break;
            }
        }
    }
    var bestValue = -Infinity, bestMove;
    for (var i = 0; i <= maxmove; i++) {
        if (moveValue[i] > bestValue) {
            bestValue = moveValue[i];
            bestMove = i;
        }
    }
    var result = (bestMove != 0);
    if (result) {
        this.root.moveOnce(left, this.currentCol, nextChessman);
        this.moved++;
    }
    return result;
}

StrongAI.prototype.fillPool = function (start, len) {
    var ret = 1;
    for (var i = start; i < start + len; i++) {
        this.pool[i] = getRandomChessman();
        if (this.pool[i] == Chessman.common)
            ret *= 0.6;
        else
            ret *= 0.1;
    }
    return ret;
}

StrongAI.prototype.getValue = function (node) {
    var totalValue = 0;
    for (var l = 0; l < node.lCol; l++) {
        var val = 0;
        for (var r = node.rCol - 1; r >= 0; r--) {
            if (node.chessmen[l][r] == Chessman.key) break;
            else val++;
        }
        if (val == node.rCol) val *= 2;
        totalValue += val;
    }
    for (var r = 0; r < node.rCol; r++) {
        var val = 0;
        for (var l = node.lCol - 1; l >= 0; l--) {
            if (node.chessmen[l][r] == Chessman.key) break;
            else val++;
        }
        if (val == node.lCol) val *= 2;
        totalValue -= val;
    }
    return totalValue;
}

StrongAI.prototype.search = function (node, depth, alpha, beta, side, poolptr) {
    if (depth == 0) return -(side * 2 - 1) * this.getValue(node);
    var bestValue = -Infinity;
    for (var l = 0; l < node.lCol; l++) {
        bestValue = Math.max(bestValue, this.searchCol(node, depth, Math.max(bestValue, alpha), beta, side, poolptr, l, maxMovements, bestValue));
        if (bestValue >= beta) {
            break;
        }
    }
    return bestValue;
}

StrongAI.prototype.searchCol = function (node, depth, alpha, beta, side, poolptr, col, bv) {
    var bestValue = -Infinity;
    var newnode = new GameNode(node.chessmen, node.lCol, node.rCol);
    for (var i = 0; i < maxMovements; i++) {
        var last = newnode.moveOnce(side, col, this.pool[poolptr++]);
        var val;
        if (last == Chessman.key) {
            val = -10000;
        }
        else {
            val = -this.search(newnode, depth - 1, -beta, -Math.max(bestValue, alpha), side ^ 1, poolptr);
        }
        bestValue = Math.max(bestValue, val);
        if (Math.max(bestValue, bv) >= beta || last == Chessman.flip || last == Chessman.key) break;
    }
    return bestValue;
}

function quickGame(ai1, ai2, loop) {
    var win1 = 0, win2 = 0;
    for (var it = 0; it < loop; it++) {
        chessmen = [];
        for (var i = 0; i < maxLCol; i++) {
            chessmen[i] = [];
            for (var j = 0; j < maxRCol; j++) {
                chessmen[i][j] = Chessman.common;
            }
        }
        var node = new GameNode(chessmen, defaultLCol, defaultRCol);
        var turn = left;
        while (true) {
            var currentAI = (turn == left ? ai1 : ai2);
            var tmpnode = new GameNode(node.chessmen, node.lCol, node.rCol);
            if (turn == right) {
                tmpnode.flip();
            }
            currentAI.loadGame(tmpnode);
            var nextChessman = getRandomChessman();
            var col = currentAI.firstMove(nextChessman);
            var end = false;
            do {
                if (node.moveOnce(turn, col, nextChessman) == Chessman.key) {
                    end = true;
                    break;
                }
                nextChessman = getRandomChessman();
            }
            while (currentAI.continue(nextChessman));
            if (end) {
                if (turn == left) win2++;
                else win1++;
                break;
            }
            turn = turn ^ 1;
        }
    }
    console.log(win1 + ":" + win2);
}
