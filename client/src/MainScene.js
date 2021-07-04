var MainScene = cc.Scene.extend({
    ctor: function () {
        this._super();

        var background = new cc.Sprite(res.MainSceneBG_png);
        background.x = size.width / 2;
        background.y = size.height / 2;
        this.addChild(background);

        var mainTitle = new cc.Sprite(res.Title_png);
        mainTitle.x = size.width / 2;
        mainTitle.y = size.height / 2 + 250;
        mainTitle.scale = 0.8;
        this.addChild(mainTitle);

        //修改昵称框
        var renameModalBox = new ModalBox(600, 350);
        this.addChild(renameModalBox, 10);

        var renameModalBoxLabel = creator.createLabel(txt.mainScene.enterNameTitle, 30);
        renameModalBoxLabel.setPosition(300, 275)
        renameModalBox.box.addChild(renameModalBoxLabel);

        var nameBox = creator.createEditBox(txt.mainScene.enterName, cc.size(400, 50));
        nameBox.setPosition(300, 175);
        renameModalBox.box.addChild(nameBox);

        confirmButton = creator.createButton(txt.menu.ok, cc.size(150, 60), function () {
            var name = nameBox.getString();
            if (name.length == 0) {
                showMessage(txt.mainScene.emptyName);
            } else if (name.length > 15) {
                showMessage(txt.mainScene.nameTooLong);
            } else {
                storage.setItem("name", name);
                updatePlayerLabel();
                renameModalBox.hide();
            }
        });
        confirmButton.setPosition(200, 75);
        renameModalBox.box.addChild(confirmButton);

        cancelButton = creator.createButton(txt.menu.cancel, cc.size(150, 60), function () {
            renameModalBox.hide();
        });
        cancelButton.setPosition(400, 75);
        renameModalBox.box.addChild(cancelButton);

        //选择ai框
        var selectAIBox = new ModalBox(800, 250);
        this.addChild(selectAIBox, 10);

        var selectAIBoxLabel = creator.createLabel(txt.mainScene.playWithAI, 30);
        selectAIBoxLabel.setPosition(400, 180)
        selectAIBox.box.addChild(selectAIBoxLabel);

        easyButton = creator.createButton(txt.ai.easy, cc.size(150, 60), function () {
            cc.director.pushScene(new AIGameScene(null, new WeakAI(), txt.ai.easy));
            selectAIBox.hide();
        });
        easyButton.setPosition(200, 80);
        selectAIBox.box.addChild(easyButton);
        normalButton = creator.createButton(txt.ai.normal, cc.size(150, 60), function () {
            cc.director.pushScene(new AIGameScene(null, new StrongAI(1, 10), txt.ai.normal));
            selectAIBox.hide();
        });
        normalButton.setPosition(400, 80);
        selectAIBox.box.addChild(normalButton);
        hardButton = creator.createButton(txt.ai.hard, cc.size(150, 60), function () {
            cc.director.pushScene(new AIGameScene(null, new StrongAI(2, 10), txt.ai.hard));
            selectAIBox.hide();
        });
        hardButton.setPosition(600, 80);
        selectAIBox.box.addChild(hardButton);

        var backButton = new ccui.Button(res.BackButtonN_png, res.BackButtonS_png);
        backButton.setPosition(60, 180);
        backButton.addClickEventListener(function () {
            selectAIBox.hide();
        });
        selectAIBox.box.addChild(backButton);

        //AI vs AI 框
        var avaBox = new ModalBox(600, 650);
        this.addChild(avaBox, 10);

        var avaBoxLabel = creator.createLabel("AI vs AI", 30);
        avaBoxLabel.setPosition(300, 580);
        avaBox.box.addChild(avaBoxLabel);
        var vsLabel = creator.createLabel("vs", 30);
        vsLabel.setPosition(300, 380);
        avaBox.box.addChild(vsLabel);
        var ai1 = new WeakAI(), ai2 = new WeakAI();
        var easy1, normal1, hard1, easy2, normal2, hard2;
        easy1 = creator.createButton("Easy", cc.size(150, 60), function () {
            easy1.loadTextureNormal(res.HighlightedButton_png);
            normal1.loadTextureNormal(res.Button_png);
            hard1.loadTextureNormal(res.Button_png);
            ai1 = new WeakAI();
        });
        easy1.loadTextureNormal(res.HighlightedButton_png);
        easy1.setPosition(150, 480);
        avaBox.box.addChild(easy1);
        normal1 = creator.createButton("Normal", cc.size(150, 60), function () {
            easy1.loadTextureNormal(res.Button_png);
            normal1.loadTextureNormal(res.HighlightedButton_png);
            hard1.loadTextureNormal(res.Button_png);
            ai1 = new StrongAI(1, 10);
        });
        normal1.setPosition(150, 380);
        avaBox.box.addChild(normal1);
        hard1 = creator.createButton("Hard", cc.size(150, 60), function () {
            easy1.loadTextureNormal(res.Button_png);
            normal1.loadTextureNormal(res.Button_png);
            hard1.loadTextureNormal(res.HighlightedButton_png);
            ai1 = new StrongAI(2, 10);
        });
        hard1.setPosition(150, 280);
        avaBox.box.addChild(hard1);
        easy2 = creator.createButton("Easy", cc.size(150, 60), function () {
            easy2.loadTextureNormal(res.HighlightedButton_png);
            normal2.loadTextureNormal(res.Button_png);
            hard2.loadTextureNormal(res.Button_png);
            ai2 = new WeakAI();
        });
        easy2.loadTextureNormal(res.HighlightedButton_png);
        easy2.setPosition(450, 480);
        avaBox.box.addChild(easy2);
        normal2 = creator.createButton("Normal", cc.size(150, 60), function () {
            easy2.loadTextureNormal(res.Button_png);
            normal2.loadTextureNormal(res.HighlightedButton_png);
            hard2.loadTextureNormal(res.Button_png);
            ai2 = new StrongAI(1, 10);
        });
        normal2.setPosition(450, 380);
        avaBox.box.addChild(normal2);
        hard2 = creator.createButton("Hard", cc.size(150, 60), function () {
            easy2.loadTextureNormal(res.Button_png);
            normal2.loadTextureNormal(res.Button_png);
            hard2.loadTextureNormal(res.HighlightedButton_png);
            ai2 = new StrongAI(2, 10);
        });
        hard2.setPosition(450, 280);
        avaBox.box.addChild(hard2);
        var quickCheckBox = creator.createCheckBoxButton("Quick Game", cc.size(250, 60), false);
        quickCheckBox.setPosition(300, 175);
        avaBox.box.addChild(quickCheckBox);
        avaConfirmButton = creator.createButton(txt.menu.ok, cc.size(150, 60), function () {
            cc.director.pushScene(new AIGameScene(ai1, ai2, "", quickCheckBox.children[0].isSelected()));
            avaBox.hide();
        });
        avaConfirmButton.setPosition(300, 75);
        avaBox.box.addChild(avaConfirmButton);
        var avaBackButton = new ccui.Button(res.BackButtonN_png, res.BackButtonS_png);
        avaBackButton.setPosition(60, 580);
        avaBackButton.addClickEventListener(function () {
            avaBox.hide();
        });
        avaBox.box.addChild(avaBackButton);

        //主界面
        var messageLabel = creator.createLabel("", 30, cc.color(255, 20, 20));
        messageLabel.setPosition(size.width / 2, size.height / 2 - 220);
        messageLabel.opacity = 0;
        this.addChild(messageLabel, 11);

        var showMessageTID;
        function showMessage(text) {
            messageLabel.string = text;
            messageLabel.opacity = 255;
            clearTimeout(showMessageTID);
            messageLabel.stopAllActions();
            showMessageTID = setTimeout(function () {
                messageLabel.runAction(cc.fadeOut(1));
            }, 2000);
        }

        var playOnlineButton = new ccui.Button(res.PlayOnlineButton_png);
        playOnlineButton.ignoreContentAdaptWithSize(false);
        playOnlineButton.setContentSize(130, 130);
        playOnlineButton.setPosition(size.width / 2, size.height / 2 + 100);
        playOnlineButton.addClickEventListener(function () {
            socket.connect(server.getWsAddress());
            socket.onError(function (e) {
                showMessage(txt.connection.error);
            });
            socket.onConnect(function () {
                cc.director.pushScene(new OnlineGameScene());
            });
        });
        this.addChild(playOnlineButton);

        var playWithAIButton = creator.createButton(txt.mainScene.playWithAI, cc.size(280, 60), function () {
            selectAIBox.popup();
        });
        var showAvaTID;
        playWithAIButton.addTouchEventListener(function (sender, type) {
            if (type == ccui.Widget.TOUCH_BEGAN) {
                showAvaTID = setTimeout(function () {
                    avaBox.popup();
                }, 5000);
            } else if (type == ccui.Widget.TOUCH_ENDED || type == ccui.Widget.TOUCH_CANCELED) {
                clearTimeout(showAvaTID);
            }
        }, this);
        playWithAIButton.setPosition(size.width / 2, size.height / 2 - 60);
        this.addChild(playWithAIButton);

        var playDoubleButton = creator.createButton(txt.mainScene.playDouble, cc.size(280, 60), function () {
            cc.director.pushScene(new DoubleGameScene());
        });
        playDoubleButton.setPosition(size.width / 2, size.height / 2 - 150);
        this.addChild(playDoubleButton);

        var playerLabel = new ccui.Button();
        playerLabel.addClickEventListener(function () {
            var name = storage.getItem("name");
            if (name) {
                nameBox.setString(name);
            }
            cancelButton.enabled = true;
            renameModalBox.popup();
        });
        playerLabel.titleColor = cc.color(0, 0, 0);
        playerLabel.titleFontSize = 25;
        this.addChild(playerLabel);
        function updatePlayerLabel() {
            var name = storage.getItem("name")
            if (name) {
                playerLabel.titleText = name;
            }
            playerLabel.setPosition(playerLabel.width / 2 + 30, size.height - playerLabel.height / 2 - 30);
        }
        updatePlayerLabel();
        if (!storage.getItem("name")) {
            cancelButton.enabled = false;
            renameModalBox.popup();
        }
        //固定界面
        var optionButton = new ccui.Button(res.OptionButtonN_png, res.OptionButtonS_png);
        optionButton.setPosition(optionButton.width / 2 + 20, optionButton.height / 2 + 20);
        optionButton.addClickEventListener(function () {
            cc.director.pushScene(new OptionScene());
        });
        this.addChild(optionButton);

        var tutorialButton = creator.createButton(txt.mainScene.tutorial, cc.size(180, 60), function () {
            cc.director.pushScene(new TutorialGameScene());
        });
        tutorialButton.setPosition(size.width - tutorialButton.width / 2 - 20, tutorialButton.height / 2 + 20);
        this.addChild(tutorialButton);
        return true;
    }
});
