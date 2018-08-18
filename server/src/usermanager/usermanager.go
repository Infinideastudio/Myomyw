package usermanager

import "gamemanager"

type User struct {
	UUID        string
	email       string
	roomPlaying *gamemanager.Room
}
