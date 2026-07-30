/**
 * 全局状态：用户、新手引导、广场、软件状态
 */
import { create } from 'zustand'
import { api, type UserInfo, type PlazaSong } from '@/lib/api'
import { getUserToken, setUserToken } from '@/lib/api'

const ONBOARDED_KEY = 'sf_onboarded'

interface AppState {
  // 软件状态
  appActive: boolean
  appChecked: boolean
  checkAppStatus: () => Promise<void>

  // 用户
  user: UserInfo | null
  loadUser: () => Promise<void>
  logout: () => void

  // 新手引导
  showOnboarding: boolean
  initOnboarding: () => void
  finishOnboarding: () => void

  // 广场
  plaza: PlazaSong[]
  loadPlaza: () => Promise<void>

  // 来自广场的改编素材
  remixSource: PlazaSong | null
  setRemixSource: (s: PlazaSong | null) => void
}

export const useStore = create<AppState>((set, get) => ({
  appActive: true,
  appChecked: false,

  checkAppStatus: async () => {
    try {
      const r = await api.status()
      set({ appActive: r.active, appChecked: true })
    } catch {
      set({ appActive: true, appChecked: true })
    }
  },

  user: null,

  loadUser: async () => {
    if (!getUserToken()) {
      set({ user: null })
      return
    }
    try {
      const r = await api.me()
      set({ user: r.user })
    } catch {
      setUserToken(null)
      set({ user: null })
    }
  },

  logout: () => {
    setUserToken(null)
    set({ user: null })
  },

  showOnboarding: false,

  initOnboarding: () => {
    const done = localStorage.getItem(ONBOARDED_KEY) === '1'
    set({ showOnboarding: !done })
  },

  finishOnboarding: () => {
    localStorage.setItem(ONBOARDED_KEY, '1')
    set({ showOnboarding: false })
  },

  plaza: [],

  loadPlaza: async () => {
    try {
      const r = await api.plaza()
      set({ plaza: r.list })
    } catch {
      /* noop */
    }
  },

  remixSource: null,
  setRemixSource: (s) => set({ remixSource: s }),
}))
