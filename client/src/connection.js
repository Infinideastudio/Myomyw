var connection = {
    server: null,

    loadServer: function (onSuccess, onError) {
        if (cc.game.config.server) {
            connection.server = cc.game.config.server;
        } else {
            var xhr = cc.loader.getXMLHttpRequest();
            var path = cc.sys.isNative ? "http://myomyw-1251252796.cos-website.ap-shanghai.myqcloud.com/res/server.txt" : "res/server.txt";
            xhr.open("GET", path);
            xhr.timeout = 5000;
            xhr.onerror = onError;
            xhr.ontimeout = onError;
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    connection.server = xhr.responseText;
                    onSuccess();
                }
            };
            xhr.send();
        }
    },

    connect: function (onSuccess, onError) {
        socket.connect("ws://" + connection.server);
        socket.onError(function (e) {
            cc.log(JSON.stringify(e));
        });
        socket.onConnect(function () {
            socket.emit("shakehand", { version: "0.8" });
            socket.onReply(function (data) {
                data.error_code == 0 ? onSuccess() : onError();
            }, onError);
        });
    },

    disconnect: function () {
        socket.disconnect();
    },

    login: function (name, onSuccess, onError) {
        socket.emit("login", { name: name }, onError.bind(null, txt.mainScene.error));
        socket.onReply(function (data) {
            if (data.error_code == 0) {
                player.name = name;
                player.guest = false;
                player.logged = true;
                onSuccess()
            } else {
                onError(txt.mainScene.wrongReply);
            }
        }, onError.bind(null, txt.mainScene.timeout));
    }
};
