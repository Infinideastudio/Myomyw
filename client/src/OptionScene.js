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

        list.addChild(creator.createButton(txt.options.lang, cc.size(600, 50), function () {
            cc.director.runScene(new LangOptionScene());
        }));

        list.addChild(creator.createButton(txt.options.about, cc.size(600, 50), function () {
            cc.director.runScene(new AboutScene());
        }));

        return true;
    }
});
