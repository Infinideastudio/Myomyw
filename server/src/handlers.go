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
		Room   []gamemanager.Room `json:"room"`
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
		Room:   server.getRooms(),
	}

}

var handlers = map[string](func(server *Server, conn *connectionData, decoder *json.Decoder) (int, interface{})){
	"version": handleVersionRequest,
	"login":   playerLogin,
}
