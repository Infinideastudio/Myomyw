package main

import (
	"usermanager"
	"utils"
)

type connectionData struct {
	uuid        string
	user        usermanager.User
	roomID      int
	playing     bool // if playing == false && roomID != -1, then the player is watching
	messageChan chan utils.Message
}

// makeConnectionData makes a new connectionData for use
func makeConnectionData() connectionData {
	var connData connectionData
	connData.roomID = -1
	connData.messageChan = make(chan utils.Message)
	return connData
}

func (conn *connectionData) isInGame() bool {
	return conn.roomID != -1
}

func (conn *connectionData) loggedIn() bool {
	return conn.uuid != ""
}
