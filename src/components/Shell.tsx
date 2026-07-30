/**
 * 应用外壳：左侧竖向导航 + 主内容区
 */
import { type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Music2, LayoutGrid, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'

const NAV = [
  { key: '/', label: '编辑', icon: Music2, desc: '创作与改编' },
  { key: '/plaza', label: '广场', icon: LayoutGrid, desc: '听别人的歌' },
  { key: '/profile', label: '我的', icon: User, desc: '登录与作品' },
]

export default function Shell({ children }: { children: ReactNode }) {
  const nav = useNavigate()
  const loc = useLocation()
  const { user } = useStore()

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
    </div>
  )
}
