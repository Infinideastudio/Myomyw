var MenuScene = cc.Scene.extend({
    ctor: function (titleText, onBack) {
        this._super();

        var backButton = new ccui.Button(res.BackButtonN_png, res.BackButtonS_png);
        backButton.setPosition(backButton.width / 2 + 10, size.height - backButton.height / 2 - 10);
        backButton.addClickEventListener(onBack);
        backButton.setName("backButton");
        this.addChild(backButton);

        var title = creator.createLabel(titleText, 35);
        title.setPosition(size.width / 2, size.height - title.height / 2 - 10);
        title.setName("title");
        this.addChild(title);

        return true;
    }
});
