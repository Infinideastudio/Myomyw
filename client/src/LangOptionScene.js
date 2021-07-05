var LangOptionScene = MenuScene.extend({
    ctor: function () {
        this._super(txt.options.lang, function () {
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

        //在这里bright反而是不高亮(别问我为啥这么做)
        var highlightedButton;
        var title = this.getChildByName("title");
        function onTouchedButton(button) {
            if (button == highlightedButton) return;
            highlightedButton.bright = true;
            highlightedButton = button;
            button.bright = false;
            function success() {
                cc.director.popToRootScene();
                cc.director.runScene(new MainScene());
                cc.director.pushScene(new OptionScene());
                cc.director.pushScene(new LangOptionScene());
            }
            if (button.tag == -1) {
                lang.loadAutoLang(success);
            }
            else {
                lang.loadLang(lang.langs[button.tag][1], success);
            }
        }

        var autoLangButton = creator.createButton(txt.options.autoLang, cc.size(600, 60), onTouchedButton);
        autoLangButton.tag = -1;
        autoLangButton.loadTextureDisabled(res.HighlightedButton_png);
        if (lang.autoLang) {
            highlightedButton = autoLangButton;
            autoLangButton.bright = false;
        }
        list.addChild(autoLangButton);

        for (var i = 0; i < lang.langs.length; i++) {
            var button = creator.createButton(lang.langs[i][0], cc.size(600, 60), onTouchedButton);
            button.tag = i;
            button.loadTextureDisabled(res.HighlightedButton_png);
            if (!lang.autoLang && lang.langs[i][1] == lang.currentLang) {
                highlightedButton = button;
                button.bright = false;
            }
            list.addChild(button);
        }
        return true;
    }
});
