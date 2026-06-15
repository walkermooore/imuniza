import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  currentUser: User | null
  token: string | null
  setCurrentUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      token: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      setToken: (token) => set({ token }),
      logout: () => set({ currentUser: null, token: null }),
    }),
    { name: 'auth-session' }
  )
)
