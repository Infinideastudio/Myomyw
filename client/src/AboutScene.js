var AboutScene = MenuScene.extend({
    ctor: function () {
        this._super(txt.options.about, function () {
            cc.director.runScene(new OptionScene());
        });

        var text = "Myomyw Alpha 0.4\nCopyright © 2016 Infinideas";
        var label = creator.createLabel(text, 20);
        label.setPosition(size.width / 2, size.height / 2);
        this.addChild(label)
        return true;
    }
});