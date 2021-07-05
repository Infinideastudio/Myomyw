var idcount = 0;
function Socket(ws) {
  this.ws = ws;
  this.id = idcount;
  idcount++;
  this.handlers = {};
  ws.on('message', function (message) {
    try {
      var index = message.indexOf('$@@$');
      if (index == -1) throw 'invalid data';
      var action = message.substr(0, index);
      var datastr = message.substr(index + 4);
      var data = datastr ? JSON.parse(datastr) : {};
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
