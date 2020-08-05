var WebSocket = WebSocket || window.WebSocket || window.MozWebSocket;
var Socket = cc.Class.extend({
    ws: null,
    handlers: {},
    ctor: function (address, onopen, onclose) {
        this.ws = new WebSocket(address);
        this.ws.onopen = onopen;
        this.ws.onclose = onclose;
        this.ws.onmessage = this._onmessage.bind(this);
    },
    _onmessage: function (e) {
        var substr = e.data.split("$@@$");
        var action = substr[0], data = JSON.parse(substr[1]);
        this.handlers[action](data);
    },
    emit: function (action, data) {
        if (data) {
            data = JSON.stringify(data);
        } else {
            data = "";
        }
        this.ws.send(action + "$@@$" + data);
    },
    on: function (action, handler) {
        this.handlers[action] = handler;
    },
    onConnect: function (handler) {
        this.ws.onopen = handler;
    },
    onDisconnect: function (handler) {
        this.ws.onclose = handler;
    },
    onError: function (handler) {
        this.ws.onerror = handler;
    },
    disconnect: function () {
        this.ws.close();
    }
});