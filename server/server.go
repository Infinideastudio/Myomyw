package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	Timeout = 5 * time.Second
	Version = "1.0"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// (WS) route /ws
func serveWs(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
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
				handler(c, parsedMessage)
			} else {
				log.Println("Error occured. Invalid action "+action.(string)+" found. The message is", parsedMessage)
				continue
			}

		}
	}
}

// (HTTP) route /is-server
func serveVersion(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/is-server" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("{\"version\": \"" + Version + "\"}"))
}
