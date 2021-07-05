var server = {
    address: null,
    message: null,
    getHttpAddress: function () {
        if (server.address.substr(0, 3) == "/s/") {
            return "https://" + server.address.substr(3);
        } else {
            return "http://" + server.address;
        }
    },
    getWsAddress: function () {
        if (server.address.substr(0, 3) == "/s/") {
            return "wss://" + server.address.substr(3);
        } else {
            return "ws://" + server.address;
        }
    },
    init: function (onSuccess, onError) {
        server.fetch(function () {
            server.handshake(onSuccess, function (error) { onError(error); });
        }, function (error) {
            onError(error);
        });
    },

    fetch: function (onSuccess, onError) {
        var customServer = storage.getItem("customServer");
        if (customServer) {
            server.address = customServer;
            onSuccess();
            return;
        } else if (cc.game.config.server) {
            server.address = cc.game.config.server;
            onSuccess();
            return;
        }
        var url = cc.sys.isNative ? "https://myomyw-1251252796.cos-website.ap-shanghai.myqcloud.com/res/server.txt" : "res/server.txt";
        http.get(url, function (data, error) {
            if (error) {
                onError(txt.connection.fetchError + error);
            }
            else {
                server.address = data;
                onSuccess();
            }
        });
    },

    handshake: function (onSuccess, onError) {
        var url = server.getHttpAddress() + "/handshake?version=0.8";
        http.getJson(url, function (data, error) {
            if (error) {
                onError(txt.connection.error + error);
            }
            else if (data.error_code != 0) {
                onError(txt.connection.wrongReply);
            }
            else {
                server.message = data.message;
                onSuccess();
            }
        });
    }
};
