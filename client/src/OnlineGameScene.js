var OnlineGameScene = GameScene.extend({
    socket: null,
    roomLabel: null,
    opponentName: null,
    disconnected: false,
    movingCol: null,
    firstMove: true,
    serverReason: null, //null为未定胜负
    clientReason: null,

    ctor: function () {
        this._super(player.name, txt.names.opponent, left, null, true);
        this.roomLabel = creator.createLabel(txt.online.connecting, 25);
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
        this.addChild(this.roomLabel);

        this.socket = new Socket("ws://" + player.server, this.onConnect.bind(this), this.onDisconnect.bind(this));
        this.socket.on("error", this.onError.bind(this));
        this.socket.on("start", this.onStart.bind(this));
        this.socket.on("nextChessman", this.onNextChessman.bind(this));
        this.socket.on("move", this.onMove.bind(this));
        this.socket.on("endTurn", this.onEndTurn.bind(this));
        this.socket.on("endGame", this.onEndGame.bind(this));
        return true;
    },

    onExit: function () {
        this._super();
        if (!this.disconnected) {
            this.socket.disconnect();
            this.disconnected = true;
        }
    },

    win: function () {
        var str = "";
        switch (this.clientReason) {
            case EndReason.opponentLeft:
                str = txt.result.opponentLeft;
                break;
            case EndReason.youWin:
                str = txt.result.youWin;
                break;
            case EndReason.opponentWins:
                str = format(txt.result.win, this.opponentName);
                break;
            case EndReason.youOutOfTime:
                str = txt.result.youOutOfTime;
                str += "\n";
                str += format(txt.result.win, this.opponentName);
                break;
            case EndReason.opponentOutOfTime:
                str = format(txt.result.outOfTime, this.opponentName);
                str += "\n";
                str += txt.result.youWin;
                break;
        }
        this.addChild(new ResultLayer(str, cc.color(0, 0, 0)));
    },

    //GameScene的回调
    onBeganMoving: function (col, last) {
        if (this.turn == left && !this.disconnected) {
            if (this.firstMove) {
                this.socket.emit("move", JSON.stringify({ col: col }));
                this.firstMove = false;
            } else {
                this.socket.emit("move", JSON.stringify({ col: col }));
            }
        }
    },

    onChangedTurn: function () {
        if (this.turn == right) {
            if (!this.disconnected) {
                this.socket.emit("endTurn", "");
            }
            this.movingCol = null;
        }
        else {
            this.firstMove = true;
        }
    },

    onWin: function (timeout) {
        if (timeout)
            this.clientReason = this.turn == left ? EndReason.youOutOfTime : EndReason.opponentOutOfTime;
        else
            this.clientReason = this.turn == left ? EndReason.opponentWins : EndReason.youWin;

        if (this.serverReason != null) {
            if (this.serverReason == this.clientReason)
                this.win();
            else {
                this.addChild(new ResultLayer(txt.result.differentResult, cc.color(0, 0, 0)));
                cc.log("server reason:" + this.serverReason);
                cc.log("client reason:" + this.clientReason);
            }
        }
    },

    //socket.io的回调
    onConnect: function () {
        this.socket.emit("login", JSON.stringify({ name: player.name }));
        this.socket.emit("match");
        this.roomLabel.string = txt.online.waiting;
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
    },

    onError: function (data) {
        cc.log(data);
    },

    onStart: function (data) {
        data = parseJson(data);
        this.roomLabel.string = format(txt.online.room, data.room);
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
        this.opponentName = data.opponentName;
        this.rightNameLabel.string = data.opponentName;
        this.rightNameLabel.setPosition(size.width - this.rightNameLabel.width / 2 - 20, size.height - this.rightNameLabel.height / 2 - 20);
        this.start(data.side);
    },

    onNextChessman: function (data) {
        data = parseJson(data);
        this.setNextChessman(data.chessman);
    },

    onMove: function (data) {
        data = parseJson(data);
        if (this.turn == right) {
            if ("col" in data && this.movingCol === null) {
                this.movingCol = data.col;
            }
            if (this.action == Action.moving) {
                this.endMovingAtOnce();
            }
            this.move(this.movingCol);
        }
    },

    onEndTurn: function () {
        if (this.turn == right) {
            if (this.action == Action.moving) {
                this.endMovingAtOnce();
            }
            //推出翻转球后上面的endMovingAtOnce会切换回合，所以要再判断一次
            if (this.turn == right) {
                this.changeTurn();
            }
        }
    },

    onEndGame: function (data) {
        data = parseJson(data);
        this.playing = false;
        this.serverReason = data.reason;
        if (this.serverReason == EndReason.opponentLeft) {
            this.clientReason = this.serverReason;
            this.stopTimer();
            this.win();
        }
        else if (this.serverReason == EndReason.serverFull) {
            this.addChild(new ResultLayer(txt.online.serverFull, cc.color(0, 0, 0)));
        }
        else {
            if (this.clientReason != null) {
                if (this.clientReason == this.serverReason)
                    this.win();
                else {
                    this.addChild(new ResultLayer(txt.result.differentResult, cc.color(0, 0, 0)));
                    cc.log("server reason:" + this.serverReason);
                    cc.log("client reason:" + this.clientReason);
                }
            }
        }
    },

    onDisconnect: function () {
        this.disconnected = true;
        if (this.serverReason == null) {
            this.socket.disconnect();
            this.playing = false;
            this.addChild(new ResultLayer(txt.result.unknownDisconnection, cc.color(0, 0, 0)));
        }
    }
});

function parseJson(str) {
    return JSON.parse(str);
}
