package main

import (
	"encoding/json"
	"gamemanager"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
	"usermanager"

	"github.com/gorilla/websocket"
)

const (
	timeout = 5 * time.Second
	// Version is the protocol version that the server uses
	Version = "1.0"
)

type Server struct {
	upgrader  websocket.Upgrader
	rooms     []gamemanager.Room
	roomMutex *sync.RWMutex
	users     map[string]usermanager.User // uuid -> User
	userMutex *sync.RWMutex
}

// NewServer Create a server instance
func NewServer() Server {
	server := Server{}
	server.upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	server.roomMutex = &sync.RWMutex{}
	server.userMutex = &sync.RWMutex{}
	server.users = make(map[string]usermanager.User)
	return server
}

func (server *Server) getRooms() []gamemanager.Room {
	server.roomMutex.RLock()
	defer server.roomMutex.RUnlock()
	return server.rooms
}
func (server *Server) findRoom(id int) gamemanager.Room {
	server.roomMutex.RLock()
	defer server.roomMutex.RUnlock()
	return server.rooms[id]
}

// Create a new room. The id of the room created will be returned
func (server *Server) createRoom(room gamemanager.Room) int {
	server.roomMutex.Lock()
	defer server.roomMutex.Unlock()
	room.ID = len(server.rooms)
	server.rooms = append(server.rooms, room)
	return room.ID
}

// Try to join a room. Return if it succeeds.
func (server *Server) joinRoom(id int, playerUUID string) bool {
	server.roomMutex.Lock()
	defer server.roomMutex.Unlock()
	if len(server.rooms[id].Players) == 2 {
		return false
	}
	server.rooms[id].Players = append(server.rooms[id].Players, playerUUID)
	return true
}

// Try to find a user. Will be created if not existing.
func (server *Server) getUser(uuid string) usermanager.User {
	server.userMutex.RLock()
	user, ok := server.users[uuid]
	server.userMutex.RUnlock()

	if !ok {
		server.userMutex.Lock()
		defer server.userMutex.Unlock()
		user = usermanager.User{UUID: uuid}
		server.users[uuid] = user
	}
	return user
}

type connectionData struct {
	uuid    string
	user    usermanager.User
	roomID  int
	playing bool // if playing == false && roomID != -1, then the player is watching
}

func sendResponse(c *websocket.Conn, headerRaw interface{}, bodyRaw interface{}) error {
	header, err := json.Marshal(headerRaw)
	if err != nil {
		return err
	}
	body, err := json.Marshal(bodyRaw)
	if err != nil {
		return err
	}
	writer, err := c.NextWriter(websocket.TextMessage)
	if err != nil {
		return err
	}
	writer.Write(header)
	writer.Write(body)
	err = writer.Close()
	if err != nil {
		return err
	}
	return nil
}

// ServeWs (WS) route /ws
func (server *Server) serveWs(w http.ResponseWriter, r *http.Request) {
	c, err := server.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()

	var connData connectionData
	connData.roomID = -1
	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			log.Println("Error occured when trying to read data:", err)
			break
		}

		if mt == websocket.TextMessage {
			var header struct {
				Action    string `json:"action"`
				Ref       int    `json:"ref"`
				ErrorCode int    `json:"error_code"`
			}
			decoder := json.NewDecoder(strings.NewReader(string(message)))

			// Decode header
			if err := decoder.Decode(&header); err != nil {
				log.Println("Error occured when trying to parse JSON:", err, ". The message is", string(message))
				continue
			}

			// Forward to handler according to action
			if handler, ok := handlers[header.Action]; ok {
				errorCode, bodyRaw := handler(server, &connData, decoder)

				// Pack response returned from handler
				header.ErrorCode = errorCode
				if bodyRaw == nil {
					bodyRaw = struct{}{}
				}
				err := sendResponse(c, header, bodyRaw)

				if err != nil {
					log.Println("Error occured when trying to send response: ", err, " body:", bodyRaw)
					continue
				}

			} else {
				log.Println("Error occured. Invalid action \"" + header.Action + "\" found.")
				continue
			}

		}
	}
}

// ServeVersion (HTTP) route /is-server
func (server Server) serveVersion(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/is-server" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("{\"version\": \"" + Version + "\"}"))
}
