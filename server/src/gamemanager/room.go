package gamemanager

import "utils"

type Room struct {
	ID          int                    `json:"id"`
	Waiting     bool                   `json:"waiting"`
	Players     []string               `json:"-"`
	Subscribers []chan<- utils.Message `json:"-"`
	Locked      bool                   `json:"locked"`
	Password    string                 `json:"-"`
}

func (room *Room) BoardcastMessage(utils.Message) {

}
