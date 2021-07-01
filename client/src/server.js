var server = {
    address: null,

    load: function (onSuccess, onError) {
        if (cc.game.config.server) {
            server.address = cc.game.config.server;
            return;
        }
        var url = cc.sys.isNative ? "http://myomyw-1251252796.cos-website.ap-shanghai.myqcloud.com/res/server.txt" : "res/server.txt";
        cc.loader.loadTxt(url, function (error, txt) {
            if (error) {
                onError(error);
            }
            else {
                server.address = txt;
                onSuccess();
            }
        });
    },

    handshake: function (onSuccess, onError) {
        var url = "http://" + server.address + "/handshake?version=0.8";
        cc.loader.loadJson(url, function (error, data) {
            if (error) {
                onError(txt.connection.error)
            }
            else if (data.error_code != 0) {
                onError(txt.connection.wrongReply)
            }
            else {
                onSuccess();
            }
        });
    }
};
