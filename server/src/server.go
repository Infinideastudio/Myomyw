package main

import (
	"encoding/json"
	"gamemanager"
	"log"
	"net/http"
	"sync"
	"time"
	"usermanager"

	"github.com/gorilla/websocket"
)

const (
	timeout = 5 * time.Second
	Version = "1.0"
)

type Server struct {
	upgrader  websocket.Upgrader
	rooms     []gamemanager.Room
	roomMutex *sync.RWMutex
	users     []usermanager.User
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
	return server
}

func (server Server) getRooms() []gamemanager.Room {
	server.roomMutex.RLock()
	defer server.roomMutex.RUnlock()
	return server.rooms
}

// ServeWs (WS) route /ws
func (server Server) serveWs(w http.ResponseWriter, r *http.Request) {
	c, err := server.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()
	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			log.Println("Error occured when trying to read data:", err)
			break
		}

		if mt == websocket.TextMessage {
			var parsedMessage interface{}
			err := json.Unmarshal(message, &parsedMessage)
			if err != nil {
				log.Println("Error occured when trying to parse JSON:", err, ". The message is", message)
				continue
			}

			action := parsedMessage.(map[string]interface{})["action"]
			if action == nil {
				log.Println("Error occured. No action contained in message. The message is", parsedMessage)
				continue
			}
			strAction, ok := action.(string)
			if !ok {
				log.Println("Error occured. Expect action to be string. The message is", parsedMessage)
				continue
			}
			if handler, ok := handlers[strAction]; ok {
				handler(server, c, message)
			} else {
				log.Println("Error occured. Invalid action "+action.(string)+" found. The message is", parsedMessage)
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
