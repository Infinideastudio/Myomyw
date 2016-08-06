var sio = require('socket.io');
var Player = require('./Player.js');

function listen(http, onConnect) {
    var io = sio(http);
    io.on('connection', function (socket) {
        var date = new Date();
        console.log(date.toString() + " " + socket.id + ' connected');
        onConnect(new Player(socket));
    });
}

module.exports.listen = listen;
