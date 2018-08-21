package utils

type MessageHeader struct {
	Action    string `json:"action"`
	Ref       int    `json:"ref"`
	ErrorCode int    `json:"error_code"`
}
type Message struct {
	Header MessageHeader
	Body   interface{}
}
