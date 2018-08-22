package main

import (
	"encoding/json"
	"gamemanager"
	"math/rand"

	uuid "github.com/satori/go.uuid"
)

func handleVersionRequest(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	return 0, struct {
		Version string `json:"version"`
	}{Version}
}

func playerLogin(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	type LoginRequest struct {
		Username string `json:"username"`
		Version  string `json:"version"`
		UUID     string `json:"uuid"`
	}
	type TopUser struct {
		Username string `json:"username"`
		Rating   int    `json:"rating"`
	}
	type LoginResponse struct {
		UUID   string             `json:"uuid"`
		Rating int                `json:"rating"`
		Rank   []TopUser          `json:"rank"`
		Rooms  []gamemanager.Room `json:"rooms"`
	}
	var request LoginRequest
	if decoder.Decode(&request) != nil {
		return 0xff, nil
	}
	// client version unmatched
	if request.Version != Version {
		return 0x03, nil
	}

	playerUUID := request.UUID

	if playerUUID == "" { // new user
		u, _ := uuid.NewV4()
		playerUUID = u.String()
	}

	conn.uuid = playerUUID
	conn.user = server.userManager.GetUser(playerUUID)

	return 0, LoginResponse{
		UUID:   playerUUID,
		Rating: 0,
		Rank:   nil,
		Rooms:  server.roomManager.GetRooms(),
	}

}

func createRoom(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	if !conn.loggedIn() {
		return 0xff, nil
	}
	if conn.isInGame() {
		return 0x14, nil // you're already in a game
	}

	type CreateRequest struct {
		Watching bool   `json:"watching"`
		Password string `json:"password"`
	}

	var request CreateRequest
	if decoder.Decode(&request) != nil {
		return 0xff, nil
	}

	var room = gamemanager.Room{
		Locked:   request.Password != "",
		Password: request.Password,
		Waiting:  true,
	}

	if !request.Watching {
		room.Players = append(room.Players, conn.uuid)
	}
	room.Subscribers = append(room.Subscribers, conn.messageChan)

	// Update connection states
	conn.roomID = server.roomManager.CreateRoom(room)
	conn.playing = !request.Watching
	return 0x00, nil

}

func joinRoom(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	if !conn.loggedIn() {
		return 0xff, nil
	}
	if conn.isInGame() {
		return 0x14, nil // you're already in a game!
	}

	type JoinRequest struct {
		Watching bool   `json:"watching"`
		NewRoom  bool   `json:"newroom"`
		RoomID   int    `json:"roomid"`
		Password string `json:"password"`
	}

	var request JoinRequest
	if decoder.Decode(&request) != nil {
		return 0xff, nil
	}

	if request.RoomID != -1 {
		if request.RoomID >= len(server.roomManager.GetRooms()) {
			return 0x12, nil
		}
		if request.Watching {
			conn.roomID = request.RoomID
			conn.playing = false
			return 0x00, nil
		}
		room := server.roomManager.FindRoom(request.RoomID)
		if room.Locked && room.Password != request.Password {
			return 0x13, nil
		}
		roomNotFull, shouldStart := server.roomManager.JoinRoom(request.RoomID, conn.uuid, conn.messageChan)
		if !roomNotFull {
			return 0x11, nil // room is full
		}
		// Successfully joined a room
		conn.roomID = request.RoomID
		conn.playing = true
		if shouldStart {
			room = server.roomManager.FindRoom(request.RoomID)
			room.Whoesturn = rand.Intn(2)
			server.roomManager.UpdateRoom(room)
			room.BoardcastMessage(generateGameStart(&server.userManager, &room, room.Whoesturn))
		}
		return 0x00, nil
	}
	// or do a matchmaking if not provided
	// TODO: implement this
	return 0xff, nil
}

func getRooms(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	return 0, struct {
		Rooms []gamemanager.Room `json:"rooms"`
	}{server.roomManager.GetRooms()}
}

func sendChat(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	if !conn.loggedIn() {
		return 0x20, nil
	}
	if !conn.isInGame() {
		return 0x21, nil // You need to be in game to send message
	}

	type ChatRequest struct {
		Message string `json:"message"`
	}
	var request ChatRequest
	if decoder.Decode(&request) != nil {
		return 0xff, nil
	}
	room := server.roomManager.FindRoom(conn.roomID)
	room.BoardcastMessage(generateChat(&server.userManager, request.Message, conn.uuid))
	return 0, nil
}

func move(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	if !conn.loggedIn() {
		return 0x20, nil
	}
	if !conn.isInGame() {
		return 0x21, nil // You need to be in game to send message
	}
	type MoveRequest struct {
		Num      int  `json:"num"`
		Handover bool `json:"handover"`
	}
	var request MoveRequest
	if decoder.Decode(&request) != nil {
		return 0xff, nil
	}

	room := server.roomManager.FindRoom(conn.roomID)
	if room.Players[room.Whoesturn] != conn.uuid {
		return 0x31, nil // It's not your turn yet
	}
	isCol := room.Whoesturn == 1
	var outBall int
	if isCol {
		_, outBall = room.Gameboard.PushCol(request.Num)
	} else {
		_, outBall = room.Gameboard.PushRow(request.Num)
	}
	conn.ballUsed++
	if request.Handover || conn.ballUsed == 4 {
		conn.ballUsed = 0
		room.Whoesturn = 1 - room.Whoesturn
	}
	errcode := 0
	if outBall == gamemanager.Key {
		errcode = 0x50
		room.Subscribers = nil
	}
	server.roomManager.UpdateRoom(room)

	room.BoardcastMessage(generateMove(isCol, request.Num, room.Gameboard.NextBall, request.Handover, errcode))

	return 0, nil
}

var handlers = map[string](func(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{})){
	"version":     handleVersionRequest,
	"login":       playerLogin,
	"join_room":   joinRoom,
	"create_room": createRoom,
	"get_rooms":   getRooms,
	"send_chat":   sendChat,
	"move":        move,
}
