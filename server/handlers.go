package main

import (
	"github.com/gorilla/websocket"
)

func handleVersionRequest(c *websocket.Conn, message interface{}) {
	c.WriteMessage(websocket.TextMessage, []byte("{\"version\": \""+Version+"\"}"))
}

var handlers = map[string](func(c *websocket.Conn, message interface{})){
	"version": handleVersionRequest,
}
