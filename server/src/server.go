package main

import (
	"encoding/json"
	"gamemanager"
	"log"
	"net/http"
	"strings"
	"time"
	"usermanager"
	"utils"

	"github.com/gorilla/websocket"
)

const (
	timeout = 5 * time.Second
	// Version is the protocol version that the server uses
	Version = "1.0"
)

type Server struct {
	upgrader    websocket.Upgrader
	roomManager gamemanager.RoomManager
	userManager usermanager.UserManager
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
	server.roomManager = gamemanager.NewRoomManager()
	server.userManager = usermanager.NewUserManager()
	return server
}

func sendResponse(c *websocket.Conn, message utils.Message) error {
	header, err := json.Marshal(message.Header)
	if err != nil {
		return err
	}
	body, err := json.Marshal(message.Body)
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

func readAndHandleData(c *websocket.Conn, server *Server, connData *connectionData) {
	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			log.Println("Error occured when trying to read a message:", err)
			continue
		}
		if mt == websocket.TextMessage {
			handleTextMessage(message, c, server, connData)
		}
	}
}

func handleTextMessage(message []byte, c *websocket.Conn, server *Server, connData *connectionData) {
	var header utils.MessageHeader
	decoder := json.NewDecoder(strings.NewReader(string(message)))

	// Decode header
	if err := decoder.Decode(&header); err != nil {
		log.Println("Error occured when trying to parse JSON:", err, ". The message is", string(message))
		return
	}

	// Forward to handler according to action
	if handler, ok := handlers[header.Action]; ok {
		errorCode, body := handler(server, connData, decoder)

		// Pack response returned from handler
		header.ErrorCode = errorCode
		if body == nil {
			body = struct{}{}
		}
		err := sendResponse(c, utils.Message{Header: header, Body: body})

		if err != nil {
			log.Println("Error occured when trying to send response: ", err, " body:", body)
			return
		}

	} else {
		log.Println("Error occured. Invalid action \"" + header.Action + "\" found.")
		return
	}
}

// ServeWs (WS) route /ws
func (server *Server) serveWs(w http.ResponseWriter, r *http.Request) {
	c, err := server.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade error:", err)
		return
	}
	defer c.Close()

	connData := makeConnectionData()
	go readAndHandleData(c, server, &connData)
	for {
		sendResponse(c, <-connData.messageChan)
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
