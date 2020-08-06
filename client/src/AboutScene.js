var AboutScene = MenuScene.extend({
    ctor: function () {
        this._super(txt.options.about, function () {
            cc.director.popScene();
        });

        var text = "Myomyw Beta 0.7\nCopyright © 2016 Infinideas";
        var label = creator.createLabel(text, 20);
        label.textAlign = cc.TEXT_ALIGNMENT_CENTER;
        label.setPosition(size.width / 2, size.height / 2);
        this.addChild(label);
        return true;
    }
});
