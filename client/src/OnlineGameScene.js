var OnlineGameScene = GameScene.extend({
    socket: null,
    roomLabel: null,
    opponentName: null,
    connected: false,
    movingCol: null,
    firstMove: true,
    shouldChangeTurn: false,
    serverReason: null,//null为未定胜负
    clientReason: null,

    ctor: function () {
        this._super(player.name, txt.names.opponent, left, null, true);
        this.roomLabel = creator.createLabel(txt.online.connecting, 25);
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
        this.addChild(this.roomLabel);

        io = window.SocketIO || window.io;
        this.socket = io.connect(player.server, { "force new connection": true });
        this.socket.on("connect", this.onConnect.bind(this));
        this.socket.on("error", this.onError.bind(this));
        this.socket.on("sendName", this.onSendName.bind(this));
        this.socket.on("start", this.onStart.bind(this));
        this.socket.on("nextChessman", this.onNextChessman.bind(this));
        this.socket.on("move", this.onMove.bind(this));
        this.socket.on("endTurn", this.onEndTurn.bind(this));
        this.socket.on("endGame", this.onEndGame.bind(this));
        this.socket.on("disconnect", this.onDisconnect.bind(this));
        return true;
    },

    onExit: function () {
        this._super();
        if (this.connected) {
            this.socket.disconnect();
            this.connected = false;
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
    onBeganMoving: function (col) {
        if (this.turn == left && this.connected) {
            if (this.firstMove) {
                this.socket.emit("move", JSON.stringify({ col: col }));
                this.firstMove = false;
            } else {
                this.socket.emit("move", "");
            }
        }
    },

    onEndedMoving: function (col) {
        if (this.turn == right && this.shouldChangeTurn) {
            this.changeTurn();
        }
    },

    onChangedTurn: function () {
        this.shouldChangeTurn = false;
        if (this.turn == right && this.connected) {
            this.socket.emit("endTurn", "");
            this.movingCol = null;
        }
        if (this.turn == left) {
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
        this.connected = true;
        this.socket.emit("sendName", JSON.stringify({ name: player.name }));
        this.roomLabel.string = txt.online.waiting;
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
    },

    onError: function (data) {
        cc.log(data);
    },

    onSendName: function (data) {
        data = parseJson(data);
        this.opponentName = data.name;
        this.rightNameLabel.string = this.opponentName;
        this.rightNameLabel.setPosition(size.width - this.rightNameLabel.width / 2 - 20, size.height - this.rightNameLabel.height / 2 - 20);
    },

    onStart: function (data) {
        data = parseJson(data);
        this.roomLabel.string = format(txt.online.room, data.room);
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
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
            this.move(this.movingCol);
        }
    },

    onEndTurn: function () {
        if (this.turn == right) {
            //如果还在移动就设置shouldEndTurn为true，这样移动完成后就会切换回合
            if (this.action == Action.moving) {
                this.shouldChangeTurn = true;
            }
            else {
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
        this.connected = false;
        if (this.serverReason == null) {
            this.socket.disconnect();
            this.playing = false;
            this.addChild(new ResultLayer(txt.result.unknownDisconnection, cc.color(0, 0, 0)));
        }
    }
});
