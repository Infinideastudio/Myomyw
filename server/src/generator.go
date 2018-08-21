package main

import (
	"gamemanager"
	"math/rand"
	"usermanager"
	"utils"
)

func generateGameStart(users *usermanager.UserManager, room *gamemanager.Room) utils.Message {
	return utils.Message{utils.MessageHeader{"start_game", 0, 0},
		struct {
			PlayerNames [2]string
			Overtime    int
			FirstID     int
		}{
			PlayerNames: [2]string{users.GetUser(room.Players[0]).Name, users.GetUser(room.Players[1]).Name},
			Overtime:    10,
			FirstID:     rand.Intn(2),
		},
	}
}
