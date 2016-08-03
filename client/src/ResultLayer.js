var ResultLayer = cc.Layer.extend({
    ctor: function (text, textcolor) {
        this._super();
        var background = new cc.LayerColor(cc.color(255, 255, 255, 150));
        this.addChild(background);
        var label = creator.createLabel(text, 50, textcolor);
        label.textAlign = cc.TEXT_ALIGNMENT_CENTER;
        label.boundingWidth = size.width;
        label.setPosition(this.width / 2, this.height / 2);
        this.addChild(label);
        return true;
    }
});
