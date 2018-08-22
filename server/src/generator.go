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
			PlayerNames [2]string `json:"player_names"`
			Overtime    int       `json:"overtime"`
			FirstID     int       `json:"first_id"`
		}{
			PlayerNames: [2]string{users.GetUser(room.Players[0]).Name, users.GetUser(room.Players[1]).Name},
			Overtime:    10,
			FirstID:     rand.Intn(2),
		},
	}
}
