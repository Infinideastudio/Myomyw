var AboutScene = MenuScene.extend({
    ctor: function () {
        this._super(txt.options.about, function () {
            cc.director.popScene();
        });

        var text = "Myomyw Beta 0.8\nCopyright © 2021 Infinideas";
        var label = creator.createLabel(text, 30);
        label.textAlign = cc.TEXT_ALIGNMENT_CENTER;
        label.setPosition(size.width / 2, size.height / 2);
        this.addChild(label);
        return true;
    }
});
