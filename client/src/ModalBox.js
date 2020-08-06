var ModalBox = cc.LayerColor.extend({
    touchEvent: null,
    ctor: function (width, height) {
        this._super(cc.color.BLACK);
        this.opacity = 80;
        this.setVisible(false);
        this.touchEvent = new cc.EventListener.create({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: false,
            onTouchBegan: function (touch, event) { return true; },
            onTouchEnded: function (touch, event) { return true; },
            onTouchMoved: function (touch, event) { return true; }
        });
        cc.eventManager.addListener(this.touchEvent, this);

        var background = new cc.Scale9Sprite(res.ModalBox_png);
        background.setPosition(size.width / 2, size.height / 2);
        background.setContentSize(width, height);
        this.addChild(background);
        return true;
    },

    popup: function () {
        this.setVisible(true);
        this.touchEvent.setSwallowTouches(true);
    },

    hide: function () {
        this.setVisible(false);
        this.touchEvent.setSwallowTouches(false);
    }
});