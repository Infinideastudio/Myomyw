cc.game.onStart = function () {
    if (!cc.sys.isNative && document.getElementById("loading"))
        document.body.removeChild(document.getElementById("loading"));

    cc.view.enableRetina(true);
    cc.view.adjustViewPort(true);
    cc.view.setDesignResolutionSize(1280, 720, cc.ResolutionPolicy.SHOW_ALL);
    cc.view.resizeWithBrowserSize(true);
    cc.view.setOrientation(cc.ORIENTATION_LANDSCAPE)
    cc.director.setClearColor(cc.color(255, 255, 255));
    size = cc.winSize;
    creator.init();
    lang.init();

    var serverInited = false;
    var showingWaitingBox = false, closeWaitingBox = null;
    var errorMessage = null;
    server.init(loadSuccess, loadError);
    function loadSuccess() {
        serverInited = true;
        if (showingWaitingBox) { closeWaitingBox(); }
    }
    function loadError(error) {
        serverInited = true;
        if (showingWaitingBox) {
            closeWaitingBox();
            messageBox(error);
        }
        else {
            errorMessage = error;
        }
    }

    if (!cc.sys.isNative) {
        cc._loaderImage = null;
    }
    
    cc.LoaderScene.preload(g_resources, function () {
        var firstScene = (storage.getItem("playedBefore") == "true") ? new MainScene() : new WelcomeScene();
        cc.director.runScene(firstScene);
        if (!serverInited) {
            closeWaitingBox = waitingBox("正在连接服务器...", firstScene);
            showingWaitingBox = true;
        }
        if (errorMessage) {
            messageBox(errorMessage, firstScene);
        }
    }, this);
};

storage = cc.sys.localStorage;
if (!cc.sys.isNative && storage.getItem("forceCanvas") == "true") {
    cc.loader.loadJson("project.json", function (err, data) {
        if (err) return cc.log("load project file failed " + err);
        data.renderMode = 1;
        cc.game.run(data);
    });
}
else {
    cc.game.run();
}
