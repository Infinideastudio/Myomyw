package gamemanager

import "utils"

type Room struct {
	ID          int                    `json:"id"`
	Waiting     bool                   `json:"waiting"`
	Players     []string               `json:"-"`
	Subscribers []chan<- utils.Message `json:"-"`
	Locked      bool                   `json:"locked"`
	Password    string                 `json:"-"`
	Gameboard   GameBoard              `json:"-"`
	Whoesturn   int                    `json:"-"`
}

// BoardcastMessage boradcasts the message to all players who are playing/watching the game
func (room *Room) BoardcastMessage(msg utils.Message) {
	for _, sub := range room.Subscribers {
		sub <- msg
	}
}
