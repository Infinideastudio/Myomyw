var OptionScene = MenuScene.extend({
    ctor: function () {
        this._super(txt.options.title, function () {
            cc.director.popScene();
        });

        list = new ccui.ListView();
        list.setDirection(ccui.ScrollView.DIR_VERTICAL);
        list.setGravity(ccui.ListView.GRAVITY_CENTER_HORIZONTAL);
        list.setItemsMargin(20);
        list.setBounceEnabled(true);
        list.setContentSize(size.width - 100, size.height - 120);
        list.setAnchorPoint(0.5, 0.5);
        list.setPosition(size.width / 2, size.height / 2 - 10);
        this.addChild(list);

        var standaloneTimerBox = creator.createCheckBoxButton(txt.options.standaloneTimer, cc.size(600, 60),
            storage.getItem("standaloneTimer") != "false", function (sender, type) {
                storage.setItem("standaloneTimer", type == ccui.CheckBox.EVENT_SELECTED ? "true" : "false");
            });
        list.addChild(standaloneTimerBox);

        if (!cc.sys.isNative) {
            var forceCanvasBox = creator.createCheckBoxButton(txt.options.forceCanvas, cc.size(600, 120),
                storage.getItem("forceCanvas") == "true", function (sender, type) {
                    storage.setItem("forceCanvas", type == ccui.CheckBox.EVENT_SELECTED ? "true" : "false");
                });
            forceCanvasBox.getTitleRenderer().textAlign = cc.TEXT_ALIGNMENT_CENTER;
            list.addChild(forceCanvasBox);
        }

        list.addChild(creator.createButton(txt.options.setBackground, cc.size(600, 60), this.setBackground.bind(this)));

        list.addChild(creator.createButton(txt.options.lang, cc.size(600, 60), function () {
            cc.director.pushScene(new LangOptionScene());
        }));

        list.addChild(creator.createButton(txt.options.about, cc.size(600, 60), function () {
            cc.director.pushScene(new AboutScene());
        }));
        return true;
    },

    setBackground: function () {
        var modalBox = new ModalBox(800, 350);
        this.addChild(modalBox, 10);

        var label = creator.createLabel(txt.options.inputBackgroundUrl, 30);
        label.setPosition(400, 275)
        modalBox.box.addChild(label);

        var inputBox = creator.createEditBox("", cc.size(650, 50));
        inputBox.setPosition(400, 175);
        var url = storage.getItem("customBackgroundUrl");
        inputBox.string = url ? url : "";
        modalBox.box.addChild(inputBox);

        confirmButton = creator.createButton(txt.menu.ok, cc.size(150, 60), function () {
            var url = inputBox.string;
            if (url == "") {
                storage.setItem("customBackgroundUrl", "");
                modalBox.hide();
                return;
            }
            var closeWaitingBox = waitingBox(txt.options.settingBackground);
            cc.loader.load(url, function (error) {
                closeWaitingBox();
                if (error) {
                    cc.log(error);
                    messageBox(txt.options.setBackgroundError);
                }
                else {
                    storage.setItem("customBackgroundUrl", url);
                    modalBox.hide();
                }
            });
        });
        confirmButton.setPosition(300, 75);
        modalBox.box.addChild(confirmButton);

        cancelButton = creator.createButton(txt.menu.cancel, cc.size(150, 60), function () {
            modalBox.hide();
        });
        cancelButton.setPosition(500, 75);
        modalBox.box.addChild(cancelButton);

        modalBox.popup();
    }
});
