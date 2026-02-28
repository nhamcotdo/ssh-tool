// ============================================================
// Auth Module — Local user accounts with scrypt hashing
// ============================================================

import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

export interface UserAccount {
  id: string
  username: string
  passwordHash: string
  salt: string
  createdAt: number
}

interface AuthStore {
  users: UserAccount[]
  currentUserId: string | null
}

const authStore = new Store<AuthStore>({
  name: 'auth',
  defaults: {
    users: [],
    currentUserId: null,
  },
})

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const hashBuffer = Buffer.from(hash, 'hex')
  const derivedKey = scryptSync(password, salt, 64)
  return timingSafeEqual(hashBuffer, derivedKey)
}

export function getUsers(): Pick<UserAccount, 'id' | 'username'>[] {
  return authStore.get('users').map(u => ({ id: u.id, username: u.username }))
}

export function getCurrentUser(): Pick<UserAccount, 'id' | 'username'> | null {
  const userId = authStore.get('currentUserId')
  if (!userId) return null
  const user = authStore.get('users').find(u => u.id === userId)
  if (!user) return null
  return { id: user.id, username: user.username }
}

export function register(username: string, password: string): { success: boolean; message: string; user?: Pick<UserAccount, 'id' | 'username'> } {
  const users = authStore.get('users')

  // Check duplicate username
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, message: 'Username already exists' }
  }

  if (!username || username.length < 2) {
    return { success: false, message: 'Username must be at least 2 characters' }
  }

  if (!password || password.length < 4) {
    return { success: false, message: 'Password must be at least 4 characters' }
  }

  const salt = randomBytes(16).toString('hex')
  const passwordHash = hashPassword(password, salt)

  const user: UserAccount = {
    id: uuidv4(),
    username,
    passwordHash,
    salt,
    createdAt: Date.now(),
  }

  users.push(user)
  authStore.set('users', users)
  authStore.set('currentUserId', user.id)

  return { success: true, message: 'Account created', user: { id: user.id, username: user.username } }
}

export function login(username: string, password: string): { success: boolean; message: string; user?: Pick<UserAccount, 'id' | 'username'> } {
  const users = authStore.get('users')
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase())

  if (!user) {
    return { success: false, message: 'Invalid username or password' }
  }

  if (!verifyPassword(password, user.salt, user.passwordHash)) {
    return { success: false, message: 'Invalid username or password' }
  }

  authStore.set('currentUserId', user.id)
  return { success: true, message: 'Logged in', user: { id: user.id, username: user.username } }
}

export function logout(): void {
  authStore.set('currentUserId', null)
}
