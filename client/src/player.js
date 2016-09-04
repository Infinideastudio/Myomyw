var player = {
    guest: false,
    logged: false,
    name: null,
    serverName: null,

    login: function (name, onConnect, onError) {
        var xhr = cc.loader.getXMLHttpRequest();
        xhr.open("GET", "http://" + cc.game.config.server + "/is-server");
        xhr.timeout = 5000;
        xhr.onerror = function (e) {
            onError(txt.mainScene.error);
        };
        xhr.ontimeout = function (e) {
            onError(txt.mainScene.timeout);
        };
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var response = xhr.responseText;
                var data = JSON.parse(response);
                if ("version" in data && "name" in data && data.version == "0.7") {
                    player.name = name;
                    player.serverName = data.name;
                    player.guest = false;
                    player.logged = true;
                    onConnect();
                } else {
                    onError(txt.mainScene.wrongReply);
                }
            }
        };
        xhr.send();
    },

    loginAsGuest: function () {
        if (!player.logged) {
            player.guest = true;
            player.logged = true;
            player.name = txt.names.guest;
        }
    },

    logout: function () {
        player.logged = false;
        player.name = txt.names.notLogged;
    },

    resetName: function () {
        if (!player.logged) {
            player.name = txt.names.notLogged;
        }
        if (player.guest) {
            player.name = txt.names.guest;
        }
    }
};
