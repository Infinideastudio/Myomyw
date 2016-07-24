cc.game.onStart = function () {
    if (!cc.sys.isNative && document.getElementById("cocosLoading"))
        document.body.removeChild(document.getElementById("cocosLoading"));

    cc.view.enableRetina(cc.sys.os === cc.sys.OS_IOS ? true : false);
    cc.view.adjustViewPort(true);
    cc.view.setDesignResolutionSize(800, 600, cc.ResolutionPolicy.SHOW_ALL);
    cc.view.resizeWithBrowserSize(true);
    storage = cc.sys.localStorage;
    creator.init();
    lang.init();
    cc.LoaderScene.preload(g_resources, function () {
        player.name = txt.names.notLogged;
        cc.director.setClearColor(cc.color(255, 255, 255));
        size = cc.winSize;
        cc.director.runScene(new MainScene());
    }, this);
};
cc.game.run();