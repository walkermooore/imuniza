import { create } from 'zustand'

const STORAGE_KEY = 'sidebar-collapsed'

interface SidebarStore {
  collapsed: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  collapsed: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })(),
  toggle: () =>
    set((state) => {
      const next = !state.collapsed
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignore
      }
      return { collapsed: next }
    }),
}))
