var config = require('./config.js')
var Room = require('./Room.js')
var URL = require('url');
var rooms = new Array();
var left = 0, right = 1;
var serverInfo = JSON.stringify({ name: config.serverName, version: config.version });

var http = require('http');
var app = http.createServer(httpHandler);
var io = require('socket.io')(app);

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
    //寻找可加入的房间
    var found = false; //是否找到了可加入的房间
    for (var i = 0; i < rooms.length; i++) {
        //如果房间为空，则建立房间并将玩家设为左边的玩家
        if (!rooms[i]) {
            found = true;
            console.log('opened room:' + i);
            rooms[i] = new Room(i, closeRoom.bind(this, i));
            rooms[i].setPlayer(left, socket);
            break;
        }
        //如果房间为等待中，则将玩家设为右边的玩家并开始游戏
        if (!rooms[i].rightPlayer) {
            found = true;
            rooms[i].setPlayer(right, socket);
            break;
        }
    }
    //如果没有找到可加入的房间，则新建一个房间
    if (!found) {
        console.log('opened room:' + i);
        room = new Room(i, closeRoom.bind(this, i));
        room.setPlayer(left, socket);
        rooms.push(room);
    }
});

function closeRoom(id) {
    if (rooms[id]) {
        rooms[id] = null;
        console.log('closed room:' + id);
        //如果房间位于结尾，则从数组里删除此房间，并向后删除可删除的房间
        if (id == rooms.length - 1) {
            var i = id;
            while (i >= 0 && !rooms[i--]) {
                rooms.pop();
            }
        }
    }
}
