function Player(socket) {
    this.socket = socket;
    this.id = socket.id;
    this.name = null;
    this.send = this.socket.emit.bind(socket);
    this.connected = true;
}

Player.prototype.on = function (event, func) {
    //这里只能挂一个函数，所以把原来的删掉
    this.socket.removeAllListeners(event);
    this.socket.on(event, function (data) {
        if (data == '' || event == 'disconnect') {
            func({});
        }
        else {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.log('%s sent "%s" with invalid data: %s',
                    this.getDescription(), event, data);
                return;
            }
            func(data);
        }
    }.bind(this));
};

Player.prototype.disconnect = function () {
    if (this.connected) {
        this.socket.disconnect();
        this.connected = false;
        console.log(this.getDescription() + ' disconnected');
    }
};

Player.prototype.getDescription = function () {
    return this.name + '(' + this.id + ')';
};

module.exports = Player;
