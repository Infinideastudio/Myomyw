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

        this.box = new cc.Scale9Sprite(res.ModalBox_png);
        this.box.setPosition(size.width / 2, size.height / 2);
        this.box.setContentSize(width, height);
        this.addChild(this.box);
        return true;
    },

    popup: function () {
        this.setVisible(true);
        this.box.setScale(0, 0);
        var scaleAction = cc.scaleTo(0.3, 1, 1).easing(cc.easeElasticOut(1));
        this.box.runAction(scaleAction);
        this.touchEvent.setSwallowTouches(true);
    },

    hide: function () {
        this.setVisible(false);
        this.touchEvent.setSwallowTouches(false);
    }
});