var OnlineGameScene = GameScene.extend({
    myName: null,
    opponentName: null,
    disconnected: false,
    movingCol: null,
    firstMove: true,
    serverReason: null, //null为未定胜负
    clientReason: null,

    ctor: function () {
        this.myName = storage.getItem("name");
        this._super(this.myName, txt.names.opponent, left, null, true);

        socket.on("matching_success", this.onStart.bind(this));
        socket.on("fill_pool", this.onFillPool.bind(this));
        socket.on("move", this.onMove.bind(this));
        socket.on("chat", this.onChat.bind(this));
        socket.on("end_turn", this.onEndTurn.bind(this));
        socket.on("end_game", this.onEndGame.bind(this));
        socket.onDisconnect(this.onDisconnect.bind(this));

        socket.emit("start_matching", { name: storage.getItem("name") });

        this.showExitModalBox = false;

        var label = creator.createLabel(txt.mainScene.playOnline, 25);
        label.setPosition(225, 680);
        this.sideBar.addChild(label);

        this.list = new ccui.ListView();
        this.list.setItemsMargin(5);
        this.list.setScrollBarEnabled(true);
        this.list.setContentSize(400, 520);
        this.list.setPosition(20, 120);
        this.sideBar.addChild(this.list);
        /*
        if ('mouse' in cc.sys.capabilities) {
            cc.eventManager.addListener({
                event: cc.EventListener.MOUSE,
                onMouseScroll: function (event) {
                    var delta = cc.sys.isNative ? event.getScrollY() * 6 : -event.getScrollY();
                    event.getCurrentTarget().moveMenu({y : delta});
                    return true;
                }
            }, this);
        */
        var inputbox = creator.createEditBox("输入聊天内容", cc.size(400, 50));
        inputbox.returnType = cc.KEYBOARD_RETURNTYPE_SEND;
        inputbox.delegate = {
            editBoxReturn: function () {
                this.addText(this.myName + ": " + inputbox.string, cc.color(130, 204, 81));
                socket.emit("send_chat", { text: inputbox.string });
                inputbox.string = "";
            }.bind(this)
        };
        inputbox.setPosition(220, 50);
        this.sideBar.addChild(inputbox);
        this.addText(txt.online.matching, cc.color(0, 0, 0));
        return true;
    },

    addText: function (string, color) {
        var text = new ccui.Text();
        text.color = color;
        text.fontName = creator.normalFont;
        text.fontSize = 25;
        text.string = string;
        text.boundingWidth = 400;
        this.list.pushBackCustomItem(text);
        this.list.jumpToBottom();
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
        exitButton.titleColor = cc.color(255, 50, 50);
        exitModalBox.box.addChild(exitButton);

        cancelButton = creator.createButton(txt.menu.continue, cc.size(200, 60), function () {
            exitModalBox.hide();
        });
        cancelButton.setPosition(150, 75);
        exitModalBox.box.addChild(cancelButton);

        var backButton = new ccui.Button(res.BackButtonN_png, res.BackButtonS_png);
        backButton.setPosition(backButton.width / 2 + 20, backButton.height / 2 + 20);
        backButton.addClickEventListener(function () {
            if (this.showExitModalBox) {
                exitModalBox.popup();
            }
            else {
                cc.director.popScene();
            }
        }.bind(this));
        this.addChild(backButton, 10);
    },

    onChat: function (data) {
        this.addText(this.opponentName + ": " + data.text, cc.color(102, 163, 255));
    },

    onExit: function () {
        this._super();
        if (!this.disconnected) {
            socket.disconnect();
            this.disconnected = true;
        }
    },

    win: function () {
        var str = "";
        switch (this.clientReason) {
            case EndReason.serverClose:
                str = txt.result.serverClose;
                break;
            case EndReason.opponentDisconnect:
                str = txt.result.opponentDisconnect;
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
        this.showExitModalBox = false;
        this.exitModalBox.hide();
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
        this.addText(format(txt.online.start, data.room_id), cc.color(0, 0, 0));
        this.opponentName = data.opponent_name;
        this.rightNameLabel.string = data.opponent_name;
        this.rightNameLabel.setPosition(size.width - this.rightNameLabel.width / 2 - 470, size.height - this.rightNameLabel.height / 2 - 30);
        this.start(data.side);
        this.showExitModalBox = true;
    },

    onFillPool: function (data) {
        this.setNextChessman(data.ball_seq[0]);
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
        if (this.serverReason == EndReason.serverClose || this.serverReason == EndReason.opponentDisconnect || this.serverReason == EndReason.opponentLeft || this.serverReason == EndReason.opponentGiveUp) {
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

    onDisconnect: function () {
        this.disconnected = true;
        if (this.serverReason == null) {
            this.playing = false;
            this.showExitModalBox = false;
            this.exitModalBox.hide();
            this.addChild(new ResultLayer(txt.result.unknownDisconnection, cc.color(0, 0, 0)));
        }
    },

    checkReason: function () {
        if (this.clientReason == this.serverReason)
            this.win();
        else {
            this.showExitModalBox = false;
            this.addChild(new ResultLayer(txt.result.differentResult, cc.color(0, 0, 0)));
            socket.emit("exception", { description: "different result! server reason:" + this.serverReason + ",client reason:" + this.clientReason })
            cc.log("server reason:" + this.serverReason);
            cc.log("client reason:" + this.clientReason);
        }
    }
});
