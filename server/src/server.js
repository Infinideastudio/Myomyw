var http = require('http');
var url = require('url');
var WebSocket = require('ws');
var config = require('./config.js');
var Socket = require('./Socket.js');
var Player = require('./Player.js');
var Room = require('./Room.js');

var httpServer = http.createServer(httpHandler);
var wsServer = new WebSocket.Server({ server: httpServer });
wsServer.on('connection', wsHandler);
httpServer.listen(config.port);
console.log('listening on port ' + config.port);

var rooms = [];
var matchingPlayer = null;
var EndReason = { serverFull: 5 };
var message = '';

function httpHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', config.allowOrigin);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate')
    var parsedUrl = url.parse(req.url, true);
    switch (parsedUrl.pathname) {
        case "/handshake":
            res.writeHead(200);
            if (parsedUrl.query.version == '0.8') {
                res.end(JSON.stringify({ errorcode: 0, message: message }));
            }
            else {
                res.end(JSON.stringify({ errorcode: 1, message: message }));
            }
            break;
        default:
            res.writeHead(400);
            res.end();
            break;
    }
}

function wsHandler(ws) {
    var socket = new Socket(ws);
    console.log('#' + socket.id + ' connected');
    socket.on('start_matching', function (data) {
        if (!data.name || data.name.length == 0 || data.name.length > 15) {
            socket.disconnect();
            return;
        }
        var player = new Player(socket, data.name);
        startMatching(player);
        ws.on('close', function () {
            console.log('#' + socket.id + ' disconnected');
            stopMatching(player);
        });
    });
}

function startMatching(player) {
    if (rooms.length < config.maxRooms) {
        console.log(player.getDescription() + " is matching");
        if (matchingPlayer == null) {
            matchingPlayer = player;
        }
        else {
            if (player.id != matchingPlayer.id) {
                openRoom(matchingPlayer, player);
                matchingPlayer = null;
            }
        }
    }
    else {
        console.log("Server is full!");
        player.emit('endGame', { reason: EndReason.serverFull });
        player.disconnect();
    }
}

function stopMatching(player) {
    if (matchingPlayer && player.id == matchingPlayer.id) {
        matchingPlayer = null;
    }
}

function openRoom(leftPlayer, rightPlayer) {
    var found = false;
    //寻找空位
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i] == null) {
            rooms[i] = new Room(leftPlayer, rightPlayer, closeRoom.bind(this, i), i);
            found = true;
            break;
        }
    }
    //如果没有找到空位，那么把新房间放在最后
    if (!found) {
        var newRoom = new Room(leftPlayer, rightPlayer, closeRoom.bind(this, rooms.length), rooms.length);
        rooms.push(newRoom);
    }
    console.log('opened room:' + i);
}

function closeRoom(id) {
    if (rooms[id]) {
        rooms[id] = null;
        console.log('closed room:' + id);
        //如果房间位于末尾，则从数组里删除此房间，并向前删除可删除的房间
        if (id == rooms.length - 1) {
            var i = id;
            while (i >= 0 && rooms[i--] == null) {
                rooms.pop();
            }
        }
    }
}
