package gamemanager

import (
	"sync"
	"utils"
)

type RoomManager struct {
	rooms     []Room
	roomMutex *sync.RWMutex
}

// NewRoomManager generates a new RoomManager instance.
func NewRoomManager() RoomManager {
	var rm RoomManager
	rm.roomMutex = &sync.RWMutex{}
	return rm
}

// GetRooms returns all available rooms in the server.
func (rm *RoomManager) GetRooms() []Room {
	rm.roomMutex.RLock()
	defer rm.roomMutex.RUnlock()
	return rm.rooms
}

// FindRoom tries to find a room with given id. Null will be returned if not found.
func (rm *RoomManager) FindRoom(id int) Room {
	rm.roomMutex.RLock()
	defer rm.roomMutex.RUnlock()
	return rm.rooms[id]
}

// CreateRoom creates a new room. The id of the room created will be returned
func (rm *RoomManager) CreateRoom(room Room) int {
	rm.roomMutex.Lock()
	defer rm.roomMutex.Unlock()
	room.ID = len(rm.rooms)
	rm.rooms = append(rm.rooms, room)
	return room.ID
}

// JoinRoom tries to join a room. Return if it succeeds and if should the caller start the game.
func (rm *RoomManager) JoinRoom(id int, playerUUID string, messageChan chan<- utils.Message) (bool, bool) {
	rm.roomMutex.Lock()
	defer rm.roomMutex.Unlock()
	if !rm.rooms[id].Waiting {
		return false, false
	}
	rm.rooms[id].Players = append(rm.rooms[id].Players, playerUUID)
	rm.rooms[id].Subscribers = append(rm.rooms[id].Subscribers, messageChan)
	rm.rooms[id].Waiting = len(rm.rooms[id].Players) != 2
	return true, len(rm.rooms[id].Players) == 2
}

// UpdateRoom updates room
func (rm *RoomManager) UpdateRoom(room Room) {
	rm.roomMutex.Lock()
	defer rm.roomMutex.Unlock()
	rm.rooms[room.ID] = room
}
