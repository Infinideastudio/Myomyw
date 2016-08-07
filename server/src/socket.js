var sio = require('socket.io');
var Player = require('./Player.js');

function listen(http, onConnect) {
    var io = sio(http);
    io.on('connection', function (socket) {
        console.log(socket.id + ' connected');
        onConnect(new Player(socket));
    });
}

module.exports.listen = listen;
