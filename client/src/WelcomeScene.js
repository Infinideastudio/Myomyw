var WelcomeScene = cc.Scene.extend({
    ctor: function () {
        this._super();
        var background = new cc.Sprite(res.MainSceneBG_png);
        background.attr({
            scale: Math.max(size.width / background.width, size.height / background.width),
            anchorX: 0.5,
            anchorY: 1,
            x: size.width / 2,
            y: size.height,
            opacity: 100
        });
        this.addChild(background);

        var label = creator.createLabel(txt.welcomeScene.title, 40);
        label.textAlign = cc.TEXT_ALIGNMENT_CENTER;
        label.boundingWidth = size.width;
        label.setPosition(this.width / 2, this.height / 2 + 100);
        this.addChild(label);

        var okButton = creator.createButton(txt.welcomeScene.ok, cc.size(100, 40), function () {
            cc.director.runScene(new TutorialGameScene());
        });
        okButton.setPosition(this.width / 2 - 100, this.height / 2 - 50);
        this.addChild(okButton);


        var skipButton = creator.createButton(txt.welcomeScene.skip, cc.size(100, 40), function () {
            cc.director.runScene(new MainScene());
        });
        skipButton.setPosition(this.width / 2 + 100, this.height / 2 - 50);
        this.addChild(skipButton);
    }
});
