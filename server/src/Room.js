var config = require('./config.js')
var EndReason = { opponentLeft: 0, youWin: 1, opponentWins: 2, youOutOfTime: 3, opponentOutOfTime: 4 };
var Chessman = { common: 0, key: 1, addCol: 2, delCol: 3, flip: 4 };
var RoomState = { waiting: 0, playing: 1, closed: 2 };
var left = 0, right = 1;

function Room(id, onClose) {
    this.chessmen = new Array();
    for (var i = 0; i < config.maxLCol; i++) {
        this.chessmen[i] = new Array();
        for (var j = 0; j < config.maxRCol; j++) {
            this.chessmen[i][j] = Chessman.common;
        }
    }
    this.lCol = config.defaultLCol;
    this.rCol = config.defaultRCol;
    this.turn = left;
    this.leftName = null;
    this.rightName = null;
    this.leftPlayer = null;
    this.rightPlayer = null;
    this.nextChessman = null;
    this.movingCol = null;
    this.state = RoomState.waiting;
    this.totalMovementTimes = 0;
    this.timeOutTID = null;
    this.id = id;
    this.onClose = onClose;
}

Room.prototype.setPlayer = function (side, socket) {
    if (!(side == left ? this.leftPlayer : this.rightPlayer)) {
        if (side == left) {
            this.leftPlayer = socket;
        } else {
            this.rightPlayer = socket;
        }
        var room = this;
        socket.on('sendName', this.onSendName.bind(this, side));
        socket.on('move', this.onMove.bind(this, side));
        socket.on('endTurn', this.onEndTurn.bind(this, side));
        socket.on('disconnect', this.onDisconnect.bind(this, side));
    }
}

Room.prototype.start = function (turn) {
    this.state = RoomState.playing;
    this.createAndTellNextChessman();
    this.leftPlayer.emit('start', { side: left, room: this.id });
    this.rightPlayer.emit('start', { side: right, room: this.id });
    this.setTurn(turn);
}

Room.prototype.currentPlayer = function () {
    return this.turn == left ? this.leftPlayer : this.rightPlayer;
}

Room.prototype.waitingPlayer = function () {
    return this.turn == left ? this.rightPlayer : this.leftPlayer;
}

Room.prototype.onSendName = function (side, data) {
    if (this.state != RoomState.waiting) return;
    data = parseJSON(data);
    if (side == left && this.leftName == null) {
        this.leftName = data.name;
    }
    else if (this.rightName == null) {
        this.rightName = data.name;
        this.leftPlayer.emit('sendName', { name: this.rightName });
        this.rightPlayer.emit('sendName', { name: this.leftName });
        this.start(left);
    }
}

//只有每回合的第一次移动才传递col
Room.prototype.onMove = function (side, data) {
    if (side != this.turn || this.state != RoomState.playing) return;
    data = parseJSON(data);
    if ('col' in data && !this.movingCol) {
        this.movingCol = data.col;
    }
    if (this.movingCol != null && this.totalMovementTimes < config.maxMovementTimes) {
        this.totalMovementTimes++;
        this.waitingPlayer().emit('move', { col: data.col });
        if (this.move(this.movingCol, this.nextChessman)) {
            this.currentPlayer().emit('endGame', { reason: EndReason.opponentWins });
            this.waitingPlayer().emit('endGame', { reason: EndReason.youWin });
            clearTimeout(this.timeOutTID);
            this.close();
        } else {
            clearTimeout(this.timeOutTID);
            //此举是为了防止两次移动间间隔时间过长
            this.timeOutTID = setTimeout(this.timeOut.bind(this), config.maxInterval);
            this.createAndTellNextChessman();
        }
    }
}

Room.prototype.onEndTurn = function (side) {
    if (side != this.turn || this.state != RoomState.playing) return;
    if (this.movingCol != null) {
        this.movingCol = null;
        this.setTurn(this.turn == left ? right : left);
        this.currentPlayer().emit('endTurn');
    }
}

Room.prototype.onDisconnect = function (side) {
    console.log('disconnected ' + (side == right ? this.rightPlayer : this.leftPlayer).id);
    if (this.state == RoomState.playing) {
        (side == left ? this.rightPlayer : this.leftPlayer).emit('endGame', { reason: EndReason.opponentLeft });
        clearTimeout(this.timeOutTID);
    }
    if (this.state != RoomState.closed) {
        this.close();
    }
}

Room.prototype.setTurn = function (turn) {
    this.turn = turn;
    this.movingCol = null;
    this.totalMovementTimes = 0;
    clearTimeout(this.timeOutTID);
    this.timeOutTID = setTimeout(this.timeOut.bind(this), config.timeLimit);
}

Room.prototype.timeOut = function () {
    this.currentPlayer().emit('endGame', { reason: EndReason.youOutOfTime });
    this.waitingPlayer().emit('endGame', { reason: EndReason.opponentOutOfTime });
    this.close();
}

Room.prototype.createAndTellNextChessman = function () {
    this.nextChessman = this.getRandomChessman();
    this.leftPlayer.emit('nextChessman', { chessman: this.nextChessman });
    this.rightPlayer.emit('nextChessman', { chessman: this.nextChessman });
}

Room.prototype.getRandomChessman = function () {
    switch (Math.floor(Math.random() * 11)) {
        case 0:
            return Chessman.key;
        case 1:
            return Chessman.addCol;
        case 2:
            return Chessman.delCol;
        case 3:
            return Chessman.flip;
        default:
            return Chessman.common;
    }
}


//返回值为是否已决胜负
Room.prototype.move = function (col, chessman) {
    var lastChessman;//暂存最底下的棋子
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


    switch (lastChessman) {
        case Chessman.key:
            return true;
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
            //这样做到推出翻转球后无法再移动
            this.totalMovementTimes = config.maxMovementTimes;
            break;
    }
    return false;
}

Room.prototype.setBoardSize = function (lCol, rCol) {
    if (lCol > config.maxLCol || lCol < config.minLCol || rCol > config.maxRCol || rCol < config.minRCol) return;
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

Room.prototype.flip = function () {
    for (var l = 0; l < config.maxLCol; l++) {
        for (var r = l + 1; r < config.maxRCol; r++) {
            this.chessmen[l][r] ^= this.chessmen[r][l];
            this.chessmen[r][l] ^= this.chessmen[l][r];
            this.chessmen[l][r] ^= this.chessmen[r][l];
        }
    }
    this.lCol ^= this.rCol;
    this.rCol ^= this.lCol;
    this.lCol ^= this.rCol;
}

Room.prototype.close = function () {
    this.state = RoomState.closed;
    if (this.leftPlayer)
        this.leftPlayer.disconnect();
    if (this.rightPlayer)
        this.rightPlayer.disconnect();
    this.onClose();
}

function parseJSON(text) {
    if (text != '') {
        try {
            var obj = JSON.parse(text);
            return obj;
        }
        catch (e) {
            console.log('json error' + e);
            return {};
        }
    } else {
        return {};
    }
}

module.exports = Room;
