﻿var config = require('./config.js');
var EndReason = { serverClose: 0, opponentDisconnect: 1, youWin: 2, opponentWins: 3, youOutOfTime: 4, opponentOutOfTime: 5, youGiveUp: 6, opponentGiveUp: 7 };
var Chessman = { common: 0, key: 1, addCol: 2, delCol: 3, flip: 4 };
var left = 0, right = 1;

function Room(leftPlayer, rightPlayer, closeHandler, id) {
    this.chessmen = [];
    for (var i = 0; i < config.maxLCol; i++) {
        this.chessmen[i] = [];
        for (var j = 0; j < config.maxRCol; j++) {
            this.chessmen[i][j] = Chessman.common;
        }
    }
    this.lCol = config.defaultLCol;
    this.rCol = config.defaultRCol;
    this.turn = left;
    this.nextChessman = null;
    this.movingCol = null;
    this.totalMovementTimes = 0;
    this.timeOutTID = null;
    this.closed = false;
    this.leftPlayer = leftPlayer;
    this.rightPlayer = rightPlayer;
    this.closeHandler = closeHandler;

    this.setPlayer(this.leftPlayer, left);
    this.setPlayer(this.rightPlayer, right);
    this.leftPlayer.emit('matching_success', { side: left, room_id: id, opponent_name: this.rightPlayer.name });
    this.rightPlayer.emit('matching_success', { side: right, room_id: id, opponent_name: this.leftPlayer.name });

    this.createAndTellNextChessman();
}

Room.prototype.setPlayer = function (player, side) {
    player.on('move', this.onMove.bind(this, side));
    player.on('end_turn', this.onEndTurn.bind(this, side));
    player.on('give_up', this.onGiveUp.bind(this, side));
    player.on('send_chat', this.onSendChat.bind(this, side));
    player.socket.ws.on('close', this.onDisconnect.bind(this, side));
};

Room.prototype.currentPlayer = function () {
    return this.turn == left ? this.leftPlayer : this.rightPlayer;
};

Room.prototype.waitingPlayer = function () {
    return this.turn == left ? this.rightPlayer : this.leftPlayer;
};

//只有每回合的第一次移动才传递col
Room.prototype.onMove = function (side, data) {
    if (side != this.turn) return;
    if ('col' in data && !this.movingCol) {
        this.movingCol = data.col;
    }
    if (this.movingCol != null && this.totalMovementTimes < config.maxMovementTimes) {
        this.totalMovementTimes++;
        this.waitingPlayer().emit('move', { col: data.col });
        if (this.move(this.movingCol, this.nextChessman)) {
            this.currentPlayer().emit('end_game', { reason: EndReason.opponentWins });
            this.waitingPlayer().emit('end_game', { reason: EndReason.youWin });
            clearTimeout(this.timeOutTID);
            this.close();
        } else {
            clearTimeout(this.timeOutTID);
            //此举是为了防止两次移动间间隔时间过长
            this.timeOutTID = setTimeout(this.timeOut.bind(this), config.maxInterval);
            this.createAndTellNextChessman();
        }
    }
};

Room.prototype.onEndTurn = function (side) {
    if (side == this.turn && this.movingCol != null && this.totalMovementTimes <= config.maxMovementTimes) {
        this.movingCol = null;
        this.setTurn(this.turn == left ? right : left);
        this.currentPlayer().emit('end_turn');
    }
};

Room.prototype.onGiveUp = function (side) {
    (side == left ? this.rightPlayer : this.leftPlayer).emit('end_game', { reason: EndReason.opponentGiveUp });
    clearTimeout(this.timeOutTID);
    this.close();
}

Room.prototype.onSendChat = function (side, data) {
    (side == left ? this.rightPlayer : this.leftPlayer).emit('chat', { text: data.text });
}

Room.prototype.onDisconnect = function (side) {
    if (!this.closed) {
        (side == left ? this.rightPlayer : this.leftPlayer).emit('end_game', { reason: EndReason.opponentDisconnect });
        clearTimeout(this.timeOutTID);
        this.close();
    }
};

Room.prototype.close = function () {
    if (!this.closed) {
        this.closed = true;
        this.leftPlayer.disconnect();
        this.rightPlayer.disconnect();
        this.closeHandler();
    }
};

Room.prototype.setTurn = function (turn) {
    this.turn = turn;
    this.movingCol = null;
    this.totalMovementTimes = 0;
    clearTimeout(this.timeOutTID);
    this.timeOutTID = setTimeout(this.timeOut.bind(this), config.timeLimit);
};

Room.prototype.timeOut = function () {
    this.currentPlayer().emit('end_game', { reason: EndReason.youOutOfTime });
    this.waitingPlayer().emit('end_game', { reason: EndReason.opponentOutOfTime });
    this.close();
};

Room.prototype.createAndTellNextChessman = function () {
    this.nextChessman = this.getRandomChessman();
    this.leftPlayer.emit('fill_pool', { ball_seq: [this.nextChessman] });
    this.rightPlayer.emit('fill_pool', { ball_seq: [this.nextChessman] });
};

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
};


//返回值为是否已决胜负
Room.prototype.move = function (col, chessman) {
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
};

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
};

Room.prototype.flip = function () {
    for (var l = 0; l < config.maxLCol; l++) {
        for (var r = l + 1; r < config.maxRCol; r++) {
            var temp = this.chessmen[l][r];
            this.chessmen[l][r] = this.chessmen[r][l];
            this.chessmen[r][l] = temp;
        }
    }
    var temp = this.rCol;
    this.rCol = this.lCol;
    this.lCol = temp;
};

module.exports = Room;
