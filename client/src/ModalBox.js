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

function messageBox(text, scene) {
    var targetScene = scene ? scene : cc.director.getRunningScene();
    var textLabel = creator.createLabel(text, 25);
    if (textLabel.width > 600) {
        textLabel.setDimensions(cc.size(600, 0));
    }
    else if (textLabel.width < 200) {
        textLabel.setDimensions(cc.size(200, 0));
        textLabel.textAlign = cc.TEXT_ALIGNMENT_CENTER;
    }
    var width = textLabel.width + 80, height = textLabel.height + 170;
    var box = new ModalBox(width, height);

    textLabel.setPosition(width / 2, height / 2 + 40);
    box.box.addChild(textLabel);

    okButton = creator.createButton(txt.menu.ok, cc.size(150, 60), function () {
        box.hide();
        targetScene.removeChild(box);
    });
    okButton.setPosition(width / 2, 60);
    box.box.addChild(okButton);

    targetScene.addChild(box, 10);
    box.popup();
}

//返回一个用于关闭该框的函数
function waitingBox(text, scene) {
    var targetScene = scene ? scene : cc.director.getRunningScene();
    var textLabel = creator.createLabel(text, 25);
    if (textLabel.width > 600) {
        textLabel.setDimensions(cc.size(600, 0));
    }
    else if (textLabel.width < 200) {
        textLabel.setDimensions(cc.size(200, 0));
        textLabel.textAlign = cc.TEXT_ALIGNMENT_CENTER;
    }
    var width = textLabel.width + 80, height = textLabel.height + 80;
    var box = new ModalBox(width, height);

    textLabel.setPosition(width / 2, height / 2);
    box.box.addChild(textLabel);

    targetScene.addChild(box, 10);
    box.popup();

    return function () {
        box.hide();
        targetScene.removeChild(box);
    }
}