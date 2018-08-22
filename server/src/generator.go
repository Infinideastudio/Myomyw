package main

import (
	"gamemanager"
	"usermanager"
	"utils"
)

func generateGameStart(users *usermanager.UserManager, room *gamemanager.Room, whofirst int) utils.Message {
	return utils.Message{utils.MessageHeader{"start_game", 0, 0},
		struct {
			PlayerNames [2]string `json:"player_names"`
			Overtime    int       `json:"overtime"`
			FirstID     int       `json:"first_id"`
		}{
			PlayerNames: [2]string{users.GetUser(room.Players[0]).Name, users.GetUser(room.Players[1]).Name},
			Overtime:    10,
			FirstID:     whofirst,
		},
	}
}

func generateChat(users *usermanager.UserManager, message string, uuid string) utils.Message {
	return utils.Message{utils.MessageHeader{"chat", 0, 0},
		struct {
			Username string `json:"username"`
			Text     string `json:"text"`
		}{
			Username: users.GetUser(uuid).Name,
			Text:     message,
		},
	}
}

func generateMove(col bool, num int, next_ball int, handover bool, errcode int) utils.Message {
	return utils.Message{utils.MessageHeader{"game_update", 0, errcode},
		struct {
			Col      bool `json:"col"`
			Num      int  `json:"num"`
			NextBall int  `json:"next_ball"`
			Handover bool `json:"handover"`
		}{
			Col:      col,
			Num:      num,
			NextBall: next_ball,
			Handover: handover,
		},
	}
}
