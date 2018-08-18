package gamemanager

type Room struct {
	ID       int      `json:"id"`
	Waiting  bool     `json:"waiting"`
	Players  []string `json:"players"`
	Locked   bool     `json:"locked"`
	Password string   `json:"-"`
}
