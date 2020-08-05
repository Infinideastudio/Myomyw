var player = {
    guest: false,
    logged: false,
    name: null,

    login: function (name, onSuccess, onError) {
        connection.login(name, onSuccess, onError);
    },

    loginAsGuest: function () {
        if (!player.logged) {
            player.guest = true;
            player.logged = true;
            player.name = txt.names.guest;
        }
    },

    logout: function () {
        if (!player.guest && player.logged) {
            connection.disconnect();
        }
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
