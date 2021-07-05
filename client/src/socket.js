var WebSocket = WebSocket || window.WebSocket || window.MozWebSocket;
var socket = {
    ws: null,
    handlers: {},

    connect: function (address) {
        if (socket.ws && !cc.sys.isNative) {
            socket.ws.close();
        }
        socket.ws = new WebSocket(address);
        socket.ws.onmessage = socket.onmessage;
    },
    onmessage: function (e) {
        var index = e.data.indexOf("$@@$");
        if (index == -1) return;
        var action = e.data.substr(0, index);
        var datastr = e.data.substr(index + 4);
        var data = datastr ? JSON.parse(datastr) : {};
        if (socket.handlers[action]) {
            socket.handlers[action](data);
        }
    },
    emit: function (action, data, error) {
        if (socket.ws.readyState != WebSocket.OPEN) {
            if (error) {
                error(txt.connection.error);
            }
            return;
        }
        if (data) {
            data = JSON.stringify(data);
        } else {
            data = "";
        }
        socket.ws.send(action + "$@@$" + data);
    },

    on: function (action, handler) {
        socket.handlers[action] = handler;
    },
    onConnect: function (handler) {
        socket.ws.onopen = handler;
    },
    onDisconnect: function (handler) {
        socket.ws.onclose = handler;
    },
    onError: function (handler) {
        socket.ws.onerror = handler;
    },
    disconnect: function () {
        socket.ws.close();
    }
}