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

        var renameModalBoxLabel = creator.createLabel("修改昵称", 30);
        renameModalBoxLabel.setPosition(size.width / 2, size.height / 2 + 100)
        renameModalBox.addChild(renameModalBoxLabel);

        var nameBox = creator.createEditBox(txt.mainScene.enterName, cc.size(500, 60));
        var lastName = storage.getItem("name");
        if (lastName) {
            nameBox.setString(lastName);
        }
        nameBox.setPosition(size.width / 2, size.height / 2);
        renameModalBox.addChild(nameBox);
        
        confirmButton = creator.createButton("确认", cc.size(150, 60), function () {
            var name = nameBox.getString();
            if (name.length == 0) {
                showMessage(txt.mainScene.emptyName);
            } else if (name.length > 15) {
                showMessage(txt.mainScene.nameTooLong);
            } else {
                player.login(nameBox.getString(), function () {
                    storage.setItem("name", name);
                    renameModalBox.hide();
                }, function (error) {
                    showMessage(error);
                });
            }

        });
        confirmButton.setPosition(size.width / 2, size.height / 2 - 100);
        renameModalBox.addChild(confirmButton);

        var messageLabel = creator.createLabel("", 30, cc.color(255, 20, 20));
        messageLabel.setPosition(size.width / 2, size.height / 2 - 220);
        messageLabel.opacity = 0;
        renameModalBox.addChild(messageLabel);

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

        //主界面
        var playOnlineButton = new ccui.Button(res.PlayOnlineButton_png);
        playOnlineButton.ignoreContentAdaptWithSize(false);
        playOnlineButton.setContentSize(130, 130);
        playOnlineButton.setPosition(size.width / 2, size.height / 2 + 100);
        playOnlineButton.addClickEventListener(function () {
            cc.director.pushScene(new OnlineGameScene());
        });
        this.addChild(playOnlineButton);

        var playWithAIButton = creator.createButton(txt.mainScene.playWithAI, cc.size(280, 60), function () {
            cc.director.pushScene(new AIGameScene());
        });
        playWithAIButton.setPosition(size.width / 2, size.height / 2 - 60);
        this.addChild(playWithAIButton);

        var playDoubleButton = creator.createButton(txt.mainScene.playDouble, cc.size(280, 60), function () {
            cc.director.pushScene(new DoubleGameScene());
        });
        playDoubleButton.setPosition(size.width / 2, size.height / 2 - 150);
        this.addChild(playDoubleButton);

        var playerLabel = new ccui.Button();
        playerLabel.addClickEventListener(renameModalBox.popup.bind(renameModalBox));
        playerLabel.titleColor = cc.color(0, 0, 0);
        playerLabel.titleFontSize = 25;
        this.addChild(playerLabel);
        function updatePlayerLabel() {
            playerLabel.titleText = player.name;
            playerLabel.setPosition(playerLabel.width / 2 + 30, size.height - playerLabel.height / 2 - 30);
        }
        updatePlayerLabel();

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
