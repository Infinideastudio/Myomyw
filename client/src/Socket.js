var WebSocket = WebSocket || window.WebSocket || window.MozWebSocket;
var socket = {
    ws: null,
    handlers: {},
    replyTimeoutTID: null,

    connect: function (address) {
        if (socket.ws) {
            socket.ws.close();
        }
        socket.ws = new WebSocket(address);
        socket.ws.onmessage = socket.onmessage;
    },
    onmessage: function (e) {
        var substr = e.data.split("$@@$");
        var action = substr[0], data = JSON.parse(substr[1]);
        if (socket.handlers[action]) {
            socket.handlers[action](data);
        }
        if (action == "reply") {
            socket.handler = null;
            if (replyTimeoutTID) {
                //不应当在正常情况下发生
                cc.log("A reply is to be waited while another is still being waited!");
                clearTimeout(replyTimeoutTID);
            }
        }
    },
    emit: function (action, data, error) {
        if (socket.ws.readyState == WebSocket.OPEN) {
            if (data) {
                data = JSON.stringify(data);
            } else {
                data = "";
            }
            socket.ws.send(action + "$@@$" + data);
        } else {
            if (error) {
                error();
            }
        }
    },
    on: function (action, handler) {
        socket.handlers[action] = handler;
    },
    onReply: function (handler, timeout) {
        socket.handlers["reply"] = handler;
        if (socket.replyTimeoutTID) {
            clearTimeout(socket.replyTimeoutTID);
        }
        if (timeout) {
            socket.replyTimeoutTID = setTimeout(timeout, 5000);
        }
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