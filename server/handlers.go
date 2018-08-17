package main

import (
	"encoding/json"
	"fmt"

	"github.com/gorilla/websocket"
	uuid "github.com/satori/go.uuid"
)

type errorResponse struct {
	Action    string `json:"action"`
	ErrorCode int    `json:"error_code"`
}

func handleVersionRequest(server Server, c *websocket.Conn, message []byte) {
	c.WriteMessage(websocket.TextMessage, []byte("{\"version\": \""+Version+"\"}"))
}

func playerLogin(server Server, c *websocket.Conn, message []byte) {
	type LoginRequest struct {
		Action   string `json:"action"`
		Username string `json:"username"`
		Version  string `json:"version"`
		UUID     string `json:"uuid"`
	}
	type TopUser struct {
		Username string `json:"username"`
		Rating   int    `json:"rating"`
	}

	type LoginResponse struct {
		Action    string    `json:"action"`
		ErrorCode int       `json:"error_code"`
		UUID      string    `json:"uuid"`
		Rating    int       `json:"rating"`
		Rank      []TopUser `json:"rank"`
		Room      []Room    `json:"room"`
	}
	var request LoginRequest
	if json.Unmarshal(message, &request) != nil {
		c.WriteJSON(errorResponse{"login", 0xff})
		return
	}
	// client version unmatched
	if request.Version != Version {
		c.WriteJSON(errorResponse{"login", 0x03})
		return
	}

	if request.UUID == "" { // new user
		usertoken, err := uuid.NewV4()
		if err != nil {
			fmt.Printf("Something went wrong: %s", err)
			return
		}
		c.WriteJSON(LoginResponse{
			Action:    "login",
			ErrorCode: 0,
			UUID:      usertoken.String(),
			Rating:    0,
			Rank:      nil,
			Room:      server.getRooms(),
		})
	} else {
		c.WriteJSON(LoginResponse{
			Action:    "login",
			ErrorCode: 0,
			UUID:      request.UUID,
			Rating:    0,
			Rank:      nil,
			Room:      server.getRooms(),
		})
	}
}

var handlers = map[string](func(server Server, c *websocket.Conn, message []byte)){
	"version": handleVersionRequest,
	"login":   playerLogin,
}
