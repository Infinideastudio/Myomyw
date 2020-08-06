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
    var ready = false;
    connection.loadServer(loaded, loaded);
    function loaded() {
        if (ready) {
            connection.connect(function(){},function(){});
            if (storage.getItem("playedBefore") == "true") {
                cc.director.runScene(new MainScene());
            }
            else {
                cc.director.runScene(new WelcomeScene());
            }
        }
        else {
            ready = true;
        }
    }

    if (!cc.sys.isNative) {
        cc._loaderImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuOWwzfk4AAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC";
    }
    cc.LoaderScene.preload(g_resources, function () {
        player.name = txt.names.notLogged;
        loaded();
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
