var WelcomeScene = cc.Scene.extend({
    ctor: function () {
        this._super();
        var background = new cc.Sprite(res.MainSceneBG_png);
        background.x = size.width / 2;
        background.y = size.height / 2;
        this.addChild(background);

        var label = creator.createLabel(txt.welcomeScene.title, 40);
        label.textAlign = cc.TEXT_ALIGNMENT_CENTER;
        label.boundingWidth = size.width;
        label.setPosition(size.width / 2, size.height / 2 + 100);
        this.addChild(label);

        var okButton = creator.createButton(txt.welcomeScene.ok, cc.size(150, 50), function () {
            storage.setItem("playedBefore", "true");
            cc.director.runScene(new TutorialGameScene());
        });
        okButton.setPosition(size.width / 2 - 120, size.height / 2 - 50);
        this.addChild(okButton);

        var skipButton = creator.createButton(txt.welcomeScene.skip, cc.size(150, 50), function () {
            storage.setItem("playedBefore", "true");
            cc.director.runScene(new MainScene());
        });
        skipButton.setPosition(size.width / 2 + 120, size.height / 2 - 50);
        this.addChild(skipButton);
    }
});
