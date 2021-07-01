var idcount = 0;
function Socket(ws) {
  this.ws = ws;
  this.id = idcount;
  idcount++;
  this.handlers = {};
  ws.on('message', function (message) {
    try {
      var substr = message.split("$@@$");
      var action = substr[0], data = substr[1] ? JSON.parse(substr[1]) : {};
    }
    catch (e) {
      console.log('#%s sent invalid data: %s', this.id, message);
      return;
    }
    if (this.handlers[action]) {
      this.handlers[action](data);
    }
  }.bind(this));
}

Socket.prototype.on = function (action, handler) {
  this.handlers[action] = handler;
};

Socket.prototype.emit = function (action, data) {
  if (data) {
    data = JSON.stringify(data);
  } else {
    data = "";
  }
  this.ws.send(action + "$@@$" + data);
};

Socket.prototype.disconnect = function () {
  this.ws.close();
};

module.exports = Socket;
