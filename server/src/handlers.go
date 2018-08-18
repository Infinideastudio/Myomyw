package main

import (
	"encoding/json"
	"gamemanager"

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
	conn.user = server.getUser(playerUUID)

	return 0, LoginResponse{
		UUID:   playerUUID,
		Rating: 0,
		Rank:   nil,
		Rooms:  server.getRooms(),
	}

}
func createRoom(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	type CreateRequest struct {
		Watching bool   `json:"watching"`
		Password string `json:"password"`
	}

	var request CreateRequest
	if decoder.Decode(&request) != nil {
		return 0xff, nil
	}
	if conn.uuid == "" {
		return 0xff, nil
	}
	var room gamemanager.Room
	room.Locked = request.Password != ""
	room.Password = request.Password
	room.Waiting = true
	if !request.Watching {
		room.Players = append(room.Players, conn.uuid)
	}
	// Update connection states
	conn.roomID = server.createRoom(room)
	conn.playing = !request.Watching
	return 0x00, nil

}
func joinRoom(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
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
		if request.RoomID >= len(server.getRooms()) {
			return 0x12, nil
		}
		if request.Watching {
			conn.roomID = request.RoomID
			conn.playing = false
			return 0x00, nil
		}
		room := server.findRoom(request.RoomID)
		if room.Locked && room.Password != request.Password {
			return 0x13, nil
		}
		if !server.joinRoom(request.RoomID, conn.uuid) {
			return 0x11, nil
		}
		return 0x00, nil
	}
	// or random choose a room if not provided
	// TODO: implement this
	return 0xff, nil
}
func getRooms(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{}) {
	return 0, struct {
		Rooms []gamemanager.Room `json:"rooms"`
	}{server.getRooms()}
}

var handlers = map[string](func(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{})){
	"version":     handleVersionRequest,
	"login":       playerLogin,
	"join_room":   joinRoom,
	"create_room": createRoom,
	"get_rooms":   getRooms,
}
