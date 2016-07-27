var http = require('http');
var app = http.createServer(httpHandler);
var io = require('socket.io')(app);
var URL = require('url');
var config = require('./config.js')
var Room = require('./Room.js')

var rooms = new Array();
var matchingPlayer = null;
var matchingPlayerName = '';
var left = 0, right = 1;
var serverInfo = JSON.stringify({ name: config.serverName, version: config.version });

function httpHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', config.allowOrigin);
    switch (URL.parse(req.url).pathname) {
        case "/is_server":
            res.writeHead(200)
            res.write(serverInfo);
            break;
        default:
            res.writeHead(400);
            break;
    }
    res.end();
}

app.listen(config.port);
console.log('listening on port ' + config.port);

io.on('connection', function (socket) {
    console.log('connected ' + socket.id);
    
    socket.on('match', function (data) {
        data = JSON.parse(data);
        if (data.name.length > 0 && data.name.length <= 15) {
            if (matchingPlayer) {
                var newRoom = new Room(matchingPlayer, socket, closeRoom.bind(this, i));
                if (socket.id != matchingPlayer.id) {
                    //寻找空位
                    var found = false;
                    var i;
                    for (i = 0; i < rooms.length; i++) {
                        if (rooms[i] == null) {
                            rooms[i] = newRoom;
                            found = true;
                            break;
                        }
                    }
                    //如果没有找到空位，那么把新房间放在最后
                    if (!found) {
                        i = rooms.push(newRoom) - 1;
                    }
                    matchingPlayer.emit('start', { side: left, room: i, opponentName: data.name });
                    socket.emit('start', { side: right, room: i, opponentName: matchingPlayerName });
                    console.log('opened room:' + i);
                }
            }
            else {
                matchingPlayer = socket;
                matchingPlayerName = data.name;
            }
        }
        else {
            socket.disconnect();
        }
    });
    
    socket.on('disconnect', function () {
        if (socket.id == matchingPlayer.id) {
            matchingPlayer = null;
        }
    });

});

function closeRoom(id) {
    if (rooms[id]) {
        if (rooms[id].leftPlayer) {
            rooms[id].leftPlayer.disconnect();
        }
        if (rooms[id].rightPlayer) {
            rooms[id].rightPlayer.disconnect();
        }
        rooms[id].ended = true;
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
