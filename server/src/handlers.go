package main

import (
	"encoding/json"
	"fmt"
	"gamemanager"

	uuid "github.com/satori/go.uuid"
)

func handleVersionRequest(server *Server, decoder *json.Decoder) (int, interface{}) {
	return 0, struct{ Version string }{Version}
}

func playerLogin(server *Server, decoder *json.Decoder) (int, interface{}) {
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

	if request.UUID == "" { // new user
		usertoken, err := uuid.NewV4()
		if err != nil {
			fmt.Printf("Failed to generate UUID: %s", err)
			return 0xff, nil
		}
		return 0, LoginResponse{
			UUID:   usertoken.String(),
			Rating: 0,
			Rank:   nil,
			Room:   server.getRooms(),
		}
	} else {
		return 0, LoginResponse{
			UUID:   request.UUID,
			Rating: 0,
			Rank:   nil,
			Room:   server.getRooms(),
		}
	}
}

var handlers = map[string](func(server *Server, decoder *json.Decoder) (int, interface{})){
	"version": handleVersionRequest,
	"login":   playerLogin,
}
