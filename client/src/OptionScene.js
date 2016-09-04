var OptionScene = MenuScene.extend({
    ctor: function () {
        this._super(txt.options.title, function () {
            cc.director.runScene(new MainScene());
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

        var standaloneTimerBox = creator.createCheckBoxButton(txt.options.standaloneTimer, cc.size(600, 50),
            storage.getItem("standaloneTimer") != "false", function (sender, type) {
                storage.setItem("standaloneTimer", type == ccui.CheckBox.EVENT_SELECTED ? "true" : "false");
            });
        list.addChild(standaloneTimerBox);

        if (!cc.sys.isNative) {
            var forceCanvasBox = creator.createCheckBoxButton(txt.options.forceCanvas, cc.size(600, 100),
            storage.getItem("forceCanvas") == "true", function (sender, type) {
                storage.setItem("forceCanvas", type == ccui.CheckBox.EVENT_SELECTED ? "true" : "false");
            });
            forceCanvasBox.getTitleRenderer().textAlign = cc.TEXT_ALIGNMENT_CENTER;
            list.addChild(forceCanvasBox);
        }

        list.addChild(creator.createButton(txt.options.lang, cc.size(600, 50), function () {
            cc.director.runScene(new LangOptionScene());
        }));

        list.addChild(creator.createButton(txt.options.about, cc.size(600, 50), function () {
            cc.director.runScene(new AboutScene());
        }));
        return true;
    }
});
