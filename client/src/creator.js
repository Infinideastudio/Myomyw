var creator = {
    normalFont: null,

    init: function () {
        switch (cc.sys.os) {
            case cc.sys.OS_WINDOWS:
                switch (cc.sys.language) {
                    case cc.sys.LANGUAGE_CHINESE:
                        //creator.normalFont = "Microsoft Yahei";
                        creator.normalFont = "";
                        break;
                    default:
                        creator.normalFont = "Arial";
                        break;
                }
                break;
            default:
                creator.normalFont = "";
                break;
        }
    },

    createLabel: function (text, size, color) {
        var label = new cc.LabelTTF(text, creator.normalFont, size);
        label.color = color ? color : cc.color(0, 0, 0);
        return label;
    },

    createEditBox: function (placeHolder, size) {
        var editBox = new cc.EditBox(size, new cc.Scale9Sprite(res.EditBox_png));
        editBox.setInputMode(cc.EDITBOX_INPUT_MODE_SINGLELINE)
        editBox.setFont(creator.normalFont, 25);
        editBox.setFontColor(cc.color(0, 0, 0));
        editBox.setPlaceHolder(placeHolder);
        editBox.setPlaceholderFont(creator.normalFont, 25);
        editBox.setPlaceholderFontColor(cc.color(100, 100, 100));
        return editBox;
    },

    createButton: function (text, size, event) {
        var button = new ccui.Button(res.Button_png);
        button.titleFontName = creator.normalFont;
        button.titleFontSize = 25;
        button.titleText = text;
        button.setScale9Enabled(true);
        button.setContentSize(size);
        button.addClickEventListener(event);
        return button;
    },

    createCheckBoxButton: function (text, size, selected, event) {
        var backgroundButton = creator.createButton(text, size, function () { });
        backgroundButton.loadTexturePressed(res.Button_png);//防止出现按下动画

        var checkBox = new ccui.CheckBox(res.CheckBoxNormal_png, res.CheckBoxNormal_png,
            res.CheckBoxActive_png, res.CheckBoxNormal_png, res.CheckBoxActive_png);
        checkBox.setPosition(backgroundButton.width - checkBox.width / 2 - 10, backgroundButton.height / 2);
        checkBox.selected = selected;
        checkBox.addEventListener(event);
        backgroundButton.addChild(checkBox);

        return backgroundButton;
    }
};
