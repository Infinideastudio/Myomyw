cc.game.onStart = function () {
    if (!cc.sys.isNative && document.getElementById("loading"))
        document.body.removeChild(document.getElementById("loading"));

    cc.view.enableRetina(cc.sys.os === cc.sys.OS_IOS ? true : false);
    cc.view.adjustViewPort(true);
    cc.view.setDesignResolutionSize(800, 600, cc.ResolutionPolicy.SHOW_ALL);
    cc.view.resizeWithBrowserSize(true);
    storage = cc.sys.localStorage;
    creator.init();
    lang.init();
    if (!cc.sys.isNative) {
        cc._loaderImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuOWwzfk4AAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC";
    }
    if (!storage.getItem("needSelect")) {
        storage.setItem("needSelect", "touches" in cc.sys.capabilities)
    }
    cc.LoaderScene.preload(g_resources, function () {
        player.name = txt.names.notLogged;
        cc.director.setClearColor(cc.color(255, 255, 255));
        size = cc.winSize;
        if (storage.getItem("playedBefore") == "true") {
            cc.director.runScene(new MainScene());
        }
        else {
            cc.director.runScene(new WelcomeScene());
        }
    }, this);
};
cc.game.run();
