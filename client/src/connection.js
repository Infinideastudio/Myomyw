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

    handshake: function (onSuccess, onError) {
        http.request("GET", "http://" + connection.server + "/handshake?version=0.8", null,
            function (data, status) {
                if (status != "success") {
                    onError(txt.connection.error)
                }
                else if (data.error_code != 0) {
                    onError(txt.connection.wrongReply)
                }
                else {
                    onSuccess();
                }
            });
    },

    connect: function (onConnect, onError) {
        socket.connect("ws://" + connection.server);
        socket.onError(function (e) {
            onError(JSON.stringify(e));
        });
        socket.onConnect(onConnect);
    },

    disconnect: function () {
        socket.disconnect();
    }
};
