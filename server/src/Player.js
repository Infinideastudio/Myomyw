function Player(socket, name) {
    this.socket = socket;
    this.id = socket.id;
    this.name = name;
    this.emit = this.socket.emit.bind(socket);
    this.on = this.socket.on.bind(socket);
    this.connected = true;
}

Player.prototype.disconnect = function () {
    if (this.connected) {
        this.socket.disconnect();
        this.connected = false;
        console.log(this.getDescription() + ' disconnected');
    }
};

Player.prototype.getDescription = function () {
    return this.name + '(#' + this.id + ')';
};

module.exports = Player;
