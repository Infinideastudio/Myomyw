var player = {
    guest: false,
    logged: false,
    name: null,
    server: null,
    serverName: null,

    login: function (name, server, onConnect, onError) {
        var xhr = cc.loader.getXMLHttpRequest();
        xhr.open("GET", getNoCacheUrl(server + "/is_server"));
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var response = xhr.responseText;
                var data = JSON.parse(response);
                if ("version" in data && "name" in data && data.version == "0.4") {
                    player.name = name;
                    player.server = server;
                    player.serverName = data.name;
                    player.guest = false;
                    player.logged = true;
                    onConnect();
                } else {
                    onError("Wrong server or the versions are not compatible.");
                }
            }
        }
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
    }
}
