cc.game.onStart = function () {
    if (!cc.sys.isNative && document.getElementById("loading"))
        document.body.removeChild(document.getElementById("loading"));

    cc.view.enableRetina(true);
    cc.view.adjustViewPort(true);
    cc.view.setDesignResolutionSize(1280, 720, cc.ResolutionPolicy.SHOW_ALL);
    cc.view.resizeWithBrowserSize(true);
    cc.view.setOrientation(cc.ORIENTATION_LANDSCAPE)
    cc.director.setClearColor(cc.color(0, 0, 0));
    size = cc.winSize;
    creator.init();
    lang.init();

    var serverInited = false;
    var showingWaitingBox = false, closeWaitingBox = null;
    var errorMessage = null;
    server.init(loadSuccess, loadError);
    function loadSuccess() {
        serverInited = true;
        if (showingWaitingBox) {
            closeWaitingBox();
            if (server.message) {
                messageBox(server.message);
            }
        }
    }
    function loadError(error) {
        serverInited = true;
        if (showingWaitingBox) {
            closeWaitingBox();
            if (server.message) {
                messageBox(server.message);
            }
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
            closeWaitingBox = waitingBox(txt.connection.connecting, firstScene);
            showingWaitingBox = true;
        }
        else if (server.message) {
            messageBox(server.message, firstScene);
        }
        if (errorMessage) {
            messageBox(errorMessage, firstScene);
        }

    }, this);

    var url = storage.getItem("customBackgroundUrl");
    if (url) {
        cc.loader.loadImg(url, function (error, data) {
            if (error) {
                cc.log(error);
                messageBox(txt.options.setBackgroundError);
            }
            else {
                if (cc.sys.isNative) {
                    img.customBackground = data;
                }
                else {
                    try {
                        var texture2d = new cc.Texture2D();
                        texture2d.initWithElement(data);
                        texture2d.handleLoadedTexture();
                        img.customBackground = texture2d;
                    }
                    catch (e) {
                        messageBox(txt.options.setBackgroundError + "(CORS)");
                    }
                }
            }
        });
    }
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
