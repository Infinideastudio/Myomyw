var http = require('http');
var url = require('url');
var config = require('./config.js');
var socket = require('./socket.js');
var Room = require('./Room.js');

var app = http.createServer(httpHandler);
var rooms = [];
var matchingPlayer = null;
var EndReason = { serverFull: 5 };
var serverInfo = JSON.stringify({ name: config.serverName, version: config.version });

function httpHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', config.allowOrigin);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate')
    switch (url.parse(req.url).pathname) {
        case "/is-server":
            res.writeHead(200);
            res.end(serverInfo);
            break;
        default:
            res.writeHead(400);
            res.end();
            break;
    }
}

app.listen(config.port);
socket.listen(app, connectHandler);
console.log('listening on port ' + config.port);

function connectHandler(player) {
    player.on('match', function (data) {
        if (rooms.length < config.maxRooms) {
            if (data.name.length > 0 && data.name.length <= 15) {
                player.name = data.name;
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
                player.disconnect();
            }
        }
        else {
            console.log("Server is full!");
            player.send('endGame', { reason: EndReason.serverFull });
            player.disconnect();
        }
    });

    player.on('disconnect', function () {
        console.log(player.id + ' disconnected');
        if (matchingPlayer && player.id == matchingPlayer.id) {
            matchingPlayer = null;
        }
    });
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
