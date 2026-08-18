/**
 * API 客户端：封装 fetch，处理鉴权与暂停状态
 */

const TOKEN_KEY = 'sf_token'

// ========================================================================
// 严格模式：管理员 token 完全不落盘（不写 localStorage / sessionStorage / cookie）
//   只存在下面这个模块级的内存变量里
//   → 刷新页面 / 关闭标签页 / 新开标签页 / 切路由再回来 → 变量被清空
//   → 100% 保证「每次打开后台都必须重新输入密码登录」
// ========================================================================
let MEMORY_ADMIN_TOKEN: string | null = null

export function getUserToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setUserToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

// 管理员：只读写内存变量，永不落盘
export function getAdminToken(): string | null {
  return MEMORY_ADMIN_TOKEN
}
export function setAdminToken(t: string | null): void {
  MEMORY_ADMIN_TOKEN = t
}
// 强制清除管理员登录态（内存态 + 旧版本遗留可能残留的 storage，保证绝对干净）
// 注意：这里用原生双 API 清，避免任何第三方缓存或全局 monkeypatch 失效
export function clearAdminAuth(): void {
  MEMORY_ADMIN_TOKEN = null
  try {
    // 兼容旧版本曾在 storage 里写过的 key，彻底清掉避免任何残留
    const legacyKeys = [
      'sf_admin_token',
      'sf_admin_token_session',
      'sf_admin_username',
    ]
    if (typeof window !== 'undefined' && window.localStorage) {
      legacyKeys.forEach((k) => window.localStorage.removeItem(k))
      // 兜底：遍历全部 key，名字里包含 admin 的全部清（防止以后加新 key 又漏）
      const adminKeys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && (k.includes('admin') || k.includes('ADMIN'))) adminKeys.push(k)
      }
      adminKeys.forEach((k) => window.localStorage.removeItem(k))
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      legacyKeys.forEach((k) => window.sessionStorage.removeItem(k))
      const adminKeys: string[] = []
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i)
        if (k && (k.includes('admin') || k.includes('ADMIN'))) adminKeys.push(k)
      }
      adminKeys.forEach((k) => window.sessionStorage.removeItem(k))
    }
  } catch { /* ignore */ }
}

export class ApiError extends Error {
  code?: string
  status: number
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface ReqOpts {
  method?: string
  body?: unknown
  auth?: 'user' | 'admin' | 'none'
  query?: Record<string, string | number | undefined>
}

async function request<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = 'user', query } = opts
  let url = path
  if (query) {
    const qs = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.set(k, String(v))
    })
    const s = qs.toString()
    if (s) url += `?${s}`
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth === 'user') {
    const t = getUserToken()
    if (t) headers.Authorization = `Bearer ${t}`
  } else if (auth === 'admin') {
    const t = getAdminToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data: any = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }

  if (!res.ok) {
    const msg = data?.error || `请求失败 (${res.status})`
    const err = new ApiError(msg, res.status, data?.code)
    // 管理员鉴权失败（401）：清掉本地 token，下次打开不会再误判
    if (res.status === 401 && auth === 'admin') {
      setAdminToken(null)
    }
    // 普通用户鉴权失败（401）：也清 token，下次自动跳登录
    if (res.status === 401 && auth === 'user') {
      setUserToken(null)
    }
    throw err
  }
  return data as T
}

/* ===== 类型 ===== */
export interface UserInfo {
  id: number
  nickname: string
  username?: string
  phoneMasked?: string
  wechatMasked?: string
  loginType: string
}
export interface Creation {
  id: number
  mode: string
  prompt?: string
  voice?: string
  title: string
  status: string
  audioUrl?: string | null
  createdAt: string
  shared: boolean
}
export interface PlazaSong {
  id: number
  creationId: number
  title: string
  author: string
  coverColor: string
  playCount: number
  remixCount: number
  sharedAt: string
}

/* ===== 普通用户 API ===== */
export const api = {
  status: () => request<{ success: boolean; active: boolean }>('/api/status', { auth: 'none' }),

  login: (body: { type?: 'wechat' | 'phone' | 'password'; username?: string; password?: string; phone?: string; code?: string; nickname?: string }) =>
    request<{ success: boolean; token: string; user: UserInfo }>('/api/auth/login', {
      method: 'POST',
      body,
      auth: 'none',
    }),

  register: (body: { username: string; password: string; nickname?: string }) =>
    request<{ success: boolean; token: string; user: UserInfo }>('/api/auth/register', {
      method: 'POST',
      body,
      auth: 'none',
    }),

  me: () => request<{ success: boolean; user: UserInfo }>('/api/auth/me'),

  createCreation: (body: {
    mode: string
    prompt?: string
    voice?: string
    sourceSongId?: number
    audioName?: string
    durationSec?: number
  }) => request<{ success: boolean; id: number; status: string; title: string }>('/api/creations', {
    method: 'POST',
    body,
  }),

  getCreation: (id: number) =>
    request<{ success: boolean; id: number; status: string; progress: number; title: string; mode: string; audioUrl?: string | null }>(
      `/api/creations/${id}`,
    ),

  myCreations: () => request<{ success: boolean; list: Creation[] }>('/api/creations/mine/list'),

  shareCreation: (id: number) =>
    request<{ success: boolean; plazaId: number }>(`/api/creations/${id}/share`, { method: 'POST' }),

  plaza: () => request<{ success: boolean; list: PlazaSong[] }>('/api/plaza', { auth: 'none' }),

  plazaPlay: (id: number) => request<{ success: boolean }>(`/api/plaza/${id}/play`, { method: 'POST', auth: 'none' }),

  plazaRemix: (id: number) =>
    request<{ success: boolean; song: { id: number; title: string; author: string; coverColor: string } }>(
      `/api/plaza/${id}/remix`,
      { method: 'POST', auth: 'none' },
    ),

  submitSuggestion: (content: string) =>
    request<{ success: boolean; id: number }>('/api/suggestions', { method: 'POST', body: { content } }),

  /* ===== 管理员 API ===== */
  adminLogin: (username: string, password: string) =>
    request<{ success: boolean; token: string }>('/api/admin/login', {
      method: 'POST',
      body: { username, password },
      auth: 'none',
    }),

  adminMe: () =>
    request<{ success: boolean; id: number; username: string }>('/api/admin/me', { auth: 'admin' }),

  adminStats: () =>
    request<{
      success: boolean
      stats: { users: number; creations: number; suggestions: number; plaza: number; active: boolean }
    }>('/api/admin/stats', { auth: 'admin' }),

  adminUsers: () =>
    request<{
      success: boolean
      list: Array<{
        id: number
        nickname: string
        phone: string | null
        wechat: string | null
        loginType: string
        creationCount: number
        paused: boolean
        createdAt: string
      }>
    }>('/api/admin/users', { auth: 'admin' }),

  adminToggleUserPause: (id: number, paused: boolean) =>
    request<{ success: boolean; paused: boolean }>(`/api/admin/users/${id}/toggle-pause`, {
      method: 'POST',
      body: { paused },
      auth: 'admin',
    }),

  adminSuggestions: () =>
    request<{
      success: boolean
      list: Array<{ id: number; content: string; resolved: boolean; createdAt: string; from: string }>
    }>('/api/admin/suggestions', { auth: 'admin' }),

  adminToggleStatus: (active: boolean) =>
    request<{ success: boolean; active: boolean }>('/api/admin/toggle-status', {
      method: 'POST',
      body: { active },
      auth: 'admin',
    }),

  adminResolveSuggestion: (id: number) =>
    request<{ success: boolean }>(`/api/admin/suggestions/${id}/resolve`, {
      method: 'POST',
      auth: 'admin',
    }),

  adminChangePassword: (oldPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/api/admin/change-password', {
      method: 'POST',
      body: { oldPassword, newPassword },
      auth: 'admin',
    }),

  adminCodeFiles: () =>
    request<{ success: boolean; files: { path: string; name: string }[] }>('/api/admin/code/files', {
      auth: 'admin',
    }),

  adminCodeRead: (path: string) =>
    request<{ success: boolean; path: string; content: string }>('/api/admin/code/file', {
      query: { path },
      auth: 'admin',
    }),

  adminCodeSave: (path: string, content: string) =>
    request<{ success: boolean; path: string }>('/api/admin/code/file', {
      method: 'PUT',
      body: { path, content },
      auth: 'admin',
    }),
}
