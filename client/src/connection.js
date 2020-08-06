var connection = {
    server: null,

    loadServer: function (onSuccess, onError) {
        if (cc.game.config.server) {
            connection.server = cc.game.config.server;
        } else {
            var url = cc.sys.isNative ? "http://myomyw-1251252796.cos-website.ap-shanghai.myqcloud.com/res/server.txt" : "res/server.txt";
            http.request("GET", url, null, function (data, status) {
                if (status == "success") {
                    connection.server = data;
                    onSuccess();
                }
                else {
                    onError(status);
                }
            });
        }
    },

    connect: function (onSuccess, onError) {
        socket.connect("ws://" + connection.server);
        socket.onError(function (e) {
            cc.log(JSON.stringify(e));
        });
        socket.onConnect(function () {
            socket.emitForReply("shakehand", { version: "0.8" }, function (data) {
                data.error_code == 0 ? onSuccess() : onError(txt.connection.wrongReply);
            }, onError);
        });
    },

    disconnect: function () {
        socket.disconnect();
    },

    login: function (name, onSuccess, onError) {
        socket.emitForReply("login", { name: name }, function (data) {
            if (data.error_code == 0) {
                onSuccess()
            } else {
                onError(txt.connection.error);
            }
        }, onError);
    }
};
