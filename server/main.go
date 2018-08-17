package main

import (
	"flag"
	"log"
	"net/http"
)

var (
	addr = flag.String("addr", "127.0.0.1:8080", "server address")
)

func main() {
	server := NewServer()
	flag.Parse()
	http.HandleFunc("/is-server", server.ServeVersion)
	http.HandleFunc("/ws", server.ServeWs)
	log.Fatal(http.ListenAndServe(*addr, nil))
}
