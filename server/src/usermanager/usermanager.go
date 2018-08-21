package usermanager

import (
	"sync"
)

type UserManager struct {
	users     map[string]User // uuid -> User
	userMutex *sync.RWMutex
}

// NewUserManager generates a new UserManager instance.
func NewUserManager() UserManager {
	var um UserManager
	um.userMutex = &sync.RWMutex{}
	um.users = make(map[string]User)
	return um
}

// GetUser tries to find a user. Will be created if not existing.
func (um *UserManager) GetUser(uuid string) User {
	um.userMutex.RLock()
	user, ok := um.users[uuid]
	um.userMutex.RUnlock()

	if !ok {
		um.userMutex.Lock()
		defer um.userMutex.Unlock()
		user = User{UUID: uuid}
		um.users[uuid] = user
	}
	return user
}
