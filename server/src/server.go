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

func (server *Server) getRooms() []gamemanager.Room {
	server.roomMutex.RLock()
	defer server.roomMutex.RUnlock()
	return server.rooms
}

// ServeWs (WS) route /ws
func (server *Server) serveWs(w http.ResponseWriter, r *http.Request) {
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
			var header struct {
				Action string
			}
			decoder := json.NewDecoder(strings.NewReader(string(message)))

			// Decode header
			if err := decoder.Decode(&header); err != nil {
				log.Println("Error occured when trying to parse JSON:", err, ". The message is", string(message))
				continue
			}

			// Forward to handler according to action
			if handler, ok := handlers[header.Action]; ok {
				errorCode, bodyRaw := handler(server, decoder)
				header, _ := json.Marshal(struct {
					Action    string `json:"action"`
					ErrorCode int    `json:"error_code"`
				}{header.Action, errorCode})
				body, err := json.Marshal(bodyRaw)
				if err != nil {
					log.Println("Error occured when trying to encode JSON:", err, "for", bodyRaw)
					continue
				}
				writer, err := c.NextWriter(websocket.TextMessage)
				if err != nil {
					log.Println("Error occured when trying to send message:", err)
					continue
				}
				writer.Write(header)
				writer.Write(body)
				writer.Close()
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
