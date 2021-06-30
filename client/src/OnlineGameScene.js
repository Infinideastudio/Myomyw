var OnlineGameScene = GameScene.extend({
    roomLabel: null,
    opponentName: null,
    disconnected: false,
    movingCol: null,
    firstMove: true,
    serverReason: null, //null为未定胜负
    clientReason: null,

    ctor: function () {
        this._super(storage.getItem("name"), txt.names.opponent, left, null, true);
        this.roomLabel = creator.createLabel(txt.online.waiting, 25);
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
        this.addChild(this.roomLabel);

        socket.on("matching_success", this.onStart.bind(this));
        socket.on("next_chessman", this.onNextChessman.bind(this));
        socket.on("move", this.onMove.bind(this));
        socket.on("end_turn", this.onEndTurn.bind(this));
        socket.on("end_game", this.onEndGame.bind(this));

        return true;
    },

    initUI: function () {
        exitModalBox = new ModalBox(300, 250);
        this.exitModalBox = exitModalBox;
        this.addChild(exitModalBox, 11);

        exitButton = creator.createButton(txt.menu.giveUp, cc.size(200, 60), function () {
            this.clientReason = EndReason.youGiveUp;
            socket.emit("give_up");
            cc.director.popScene();
        });
        exitButton.setPosition(150, 175);
        exitModalBox.box.addChild(exitButton);

        cancelButton = creator.createButton(txt.menu.continue, cc.size(200, 60), function () {
            exitModalBox.hide();
        });
        cancelButton.setPosition(150, 75);
        exitModalBox.box.addChild(cancelButton);

        var backButton = new ccui.Button(res.BackButtonN_png, res.BackButtonS_png);
        backButton.setPosition(backButton.width / 2 + 20, backButton.height / 2 + 20);
        backButton.addClickEventListener(function () {
            if (this.gameEnded) {
                cc.director.popScene();
            }
            else {
                exitModalBox.popup();
            }
        }.bind(this));
        this.addChild(backButton, 10);
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
            case EndReason.youGiveUp:
                str = txt.result.youOutOfTime;
                str += "\n";
                str += format(txt.result.giveUp, this.opponentName);
                break;
            case EndReason.opponentGiveUp:
                str = format(txt.result.giveUp, this.opponentName);
                str += "\n";
                str += txt.result.youWin;
                break;
        }
        this.gameEnded = true;
        this.addChild(new ResultLayer(str, cc.color(0, 0, 0)));
    },

    //GameScene的回调
    onBeganMoving: function (col, last) {
        if (this.turn == left && !this.disconnected) {
            if (this.firstMove) {
                socket.emit("move", { col: col });
                this.firstMove = false;
            } else {
                socket.emit("move");
            }
        }
    },

    onChangedTurn: function () {
        if (this.turn == right) {
            if (!this.disconnected) {
                socket.emit("end_turn");
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
            this.checkReason();
        }
    },

    onStart: function (data) {
        this.roomLabel.string = format(txt.online.room, data.room_id);
        this.roomLabel.setPosition(size.width - this.roomLabel.width / 2 - 10, this.roomLabel.height / 2 + 10);
        this.opponentName = data.opponent_name;
        this.rightNameLabel.string = data.opponent_name;
        this.rightNameLabel.setPosition(size.width - this.rightNameLabel.width / 2 - 20, size.height - this.rightNameLabel.height / 2 - 20);
        this.start(data.side);
    },

    onNextChessman: function (data) {
        this.setNextChessman(data.next_ball);
    },

    onMove: function (data) {
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
        this.playing = false;
        this.serverReason = data.reason;
        if (this.serverReason == EndReason.opponentLeft || this.serverReason == EndReason.opponentGiveUp) {
            this.clientReason = this.serverReason;
            this.stopTimer();
            this.win();
        }
        else {
            if (this.clientReason != null) {
                this.checkReason();
            }

        }
    },

    checkReason: function () {
        if (this.clientReason == this.serverReason)
            this.win();
        else {
            this.gameEnded = true;
            this.addChild(new ResultLayer(txt.result.differentResult, cc.color(0, 0, 0)));
            socket.emit("exception", { description: "different result! server reason:" + this.serverReason + ",client reason:" + this.clientReason })
            cc.log("server reason:" + this.serverReason);
            cc.log("client reason:" + this.clientReason);
        }
    }
});
