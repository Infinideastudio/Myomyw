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
	flag.Parse()
	http.HandleFunc("/is-server", serveVersion)
	http.HandleFunc("/ws", serveWs)
	log.Fatal(http.ListenAndServe(*addr, nil))
}
