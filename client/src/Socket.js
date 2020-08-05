var WebSocket = WebSocket || window.WebSocket || window.MozWebSocket;
var Socket = cc.Class.extend({
    ws: null,
    handlers: {},
    ctor: function (address, onopen, onclose) {
        this.ws = new WebSocket(address);
        this.ws.onopen = onopen;
        this.ws.onclose = onclose;
        this.ws.onmessage = this.onmessage.bind(this);
    },
    onmessage: function (e) {
        var substr = e.data.split("$@@$");
        this.handlers[substr[0]](substr[1]);
    },
    emit: function (action, data) {
        this.ws.send(action + "$@@$" + (data ? data : ""));
    },
    on: function (action, handler) {
        this.handlers[action] = handler;
    },
    disconnect: function () {
        this.ws.close();
    }
});