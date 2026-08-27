/**
 * 应用外壳：左侧竖向导航 + 主内容区
 * 内置自动版本检查：发现后端构建版本比当前页面 meta 中的版本新时，提示并强制绕过缓存刷新
 */
import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Music2, LayoutGrid, User, Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'

const NAV = [
  { key: '/', label: '编辑', icon: Music2, desc: '创作与改编' },
  { key: '/plaza', label: '广场', icon: LayoutGrid, desc: '听别人的歌' },
  { key: '/profile', label: '我的', icon: User, desc: '登录与作品' },
  { key: '/download', label: '下载', icon: Download, desc: '安装到电脑' },
]

// 版本检查配置
const DEFAULT_INTERVAL_MS = 30 * 1000 // 30 秒
const BACKOFF_INTERVAL_MS = 3 * 60 * 1000 // 请求失败时退避到 3 分钟
const RELOAD_COOLDOWN_MS = 2 * 60 * 1000 // 同一新版本发现后 2 分钟内只提示/刷新一次
const LS_LAST_RELOAD_KEY = 'app_version_last_reload'
const LS_LAST_SEEN_KEY = 'app_version_last_seen'

/**
 * 读取当前运行页面的版本号（由 Vite 插件在构建时注入 <meta name="app-version">）
 * 开发环境没有 meta，返回 dev 并跳过轮询
 */
function getCurrentMetaVersion(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="app-version"]')
  return meta?.content?.trim() || 'dev'
}

export default function Shell({ children }: { children: ReactNode }) {
  const nav = useNavigate()
  const loc = useLocation()
  const { user } = useStore()
  const [updateToast, setUpdateToast] = useState<{ show: boolean; version: string }>({
    show: false,
    version: '',
  })

  // 自动版本检查（仅生产环境启用）
  useEffect(() => {
    const currentVersion = getCurrentMetaVersion()
    // 开发模式 / 没有构建 meta 时不做轮询
    if (currentVersion === 'dev') return

    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let consecFails = 0

    async function checkOnce() {
      if (stopped) return
      try {
        // 加时间戳 query + cache:no-store，双保险绕过 QQ/夸克等浏览器的激进缓存
        const url = `/api/version?_=${Date.now()}`
        const resp = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (!resp.ok) throw new Error(`status ${resp.status}`)
        const data = await resp.json()
        if (!data?.success || !data?.version) {
          throw new Error('invalid version payload')
        }

        consecFails = 0
        const remote: string = String(data.version)

        // 远端也是 dev，跳过（Vite dev server 代理到后端的情况）
        if (remote === 'dev') return

        // 版本一致：记录下最后看到的版本，便于调试
        if (remote === currentVersion) {
          try {
            localStorage.setItem(LS_LAST_SEEN_KEY, `${remote}|${Date.now()}`)
          } catch {
            /* ignore */
          }
          return
        }

        // 版本不一致 -> 防止刷新风暴：
        // 1) 同一个 remote version 已经做过刷新，就不再重复触发
        // 2) 或最近 2 分钟内刷新过，也不再触发
        try {
          const lastReloadRaw = localStorage.getItem(LS_LAST_RELOAD_KEY)
          if (lastReloadRaw) {
            const [lastVersion, lastTsStr] = lastReloadRaw.split('|')
            const lastTs = Number(lastTsStr) || 0
            if (lastVersion === remote || Date.now() - lastTs < RELOAD_COOLDOWN_MS) {
              // 已处理过，静默忽略
              return
            }
          }
          // 记录本次将刷新的版本，避免刷新后再次命中
          localStorage.setItem(LS_LAST_RELOAD_KEY, `${remote}|${Date.now()}`)
        } catch {
          /* ignore quota / disabled localStorage */
        }

        // 显示 Toast 并在短暂延迟后强制跳过缓存刷新
        setUpdateToast({ show: true, version: remote })
        // 给用户 1.2s 看到提示
        setTimeout(() => {
          // location.href 方式 + 时间戳 query，比 reload(true) 在更多浏览器中能绕过缓存
          try {
            const nextUrl = new URL(window.location.href)
            nextUrl.searchParams.set('_v', remote)
            window.location.href = nextUrl.toString()
          } catch {
            window.location.reload()
          }
        }, 1200)
        return
      } catch (err) {
        // 请求失败 -> 指数退避（最多退到 3 分钟），避免短时间反复请求
        consecFails += 1
        console.debug('[version-check] request failed, consecFails=', consecFails, err)
      } finally {
        if (!stopped) {
          const nextDelay = consecFails === 0
            ? DEFAULT_INTERVAL_MS
            : Math.min(DEFAULT_INTERVAL_MS * Math.pow(2, consecFails), BACKOFF_INTERVAL_MS)
          timer = setTimeout(checkOnce, nextDelay)
        }
      }
    }

    // 首次检查延迟 2s，避免页面刚加载时和首屏请求抢带宽
    timer = setTimeout(checkOnce, 2000)

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <div className="h-screen w-screen flex bg-paper overflow-hidden">
      {/* 左侧导航 */}
      <aside className="w-64 flex-shrink-0 border-r border-line bg-cream/60 flex flex-col">
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ink flex items-center justify-center overflow-hidden">
              <img src="/favicon.svg" alt="logo" className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display text-xl font-semibold leading-none">音乐制作工具</div>
              <div className="text-[10px] text-muted tracking-widest mt-0.5">MUSIC MAKER</div>
            </div>
          </div>
        </div>

        <nav className="px-3 flex-1">
          {NAV.map((item) => {
            const active = loc.pathname === item.key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => nav(item.key)}
                className={cn(
                  'group relative w-full flex items-center gap-3 px-3 py-3 rounded-2xl mb-1 transition-all',
                  active ? 'bg-paper shadow-soft' : 'hover:bg-paper/60',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-coral" />
                )}
                <Icon
                  size={20}
                  className={cn('transition-colors', active ? 'text-coral' : 'text-muted group-hover:text-ink')}
                />
                <div className="text-left">
                  <div className={cn('text-sm font-semibold', active ? 'text-ink' : 'text-ink/80')}>
                    {item.label}
                  </div>
                  <div className="text-[11px] text-muted">{item.desc}</div>
                </div>
              </button>
            )
          })}
        </nav>

        {/* 用户区 */}
        <div className="p-3 border-t border-line">
          <button
            onClick={() => nav('/profile')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-paper/60 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-coral/15 flex items-center justify-center text-coral font-semibold text-sm">
              {user ? user.nickname.slice(0, 1) : '?'}
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {user ? user.nickname : '未登录'}
              </div>
              <div className="text-[11px] text-muted">
                {user ? '已登录' : '点此登录'}
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 overflow-y-auto bg-paper">{children}</main>

      {/* 发现新版本提示 Toast */}
      {updateToast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] shadow-2xl rounded-2xl bg-ink text-paper px-5 py-3 flex items-center gap-3 border border-white/10">
          <div className="w-8 h-8 rounded-full bg-coral/20 flex items-center justify-center">
            <RefreshCw size={16} className="text-coral animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">发现新版本，正在刷新…</div>
            <div className="text-[11px] text-paper/60 mt-0.5">
              构建号 {updateToast.version.slice(0, 8)}… · 请勿关闭页面
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
