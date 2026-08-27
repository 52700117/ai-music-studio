/**
 * 管理后台控制台
 * - 统计概览
 * - 用户列表（脱敏）
 * - 用户建议
 * - 暂停 / 恢复软件
 * - 代码编辑
 */
import { useEffect, useState } from 'react'
import { Shield, Users, Lightbulb, Power, Code, LogOut, Check, Music2, Eye, PauseCircle, PlayCircle, KeyRound, X, UserCog } from 'lucide-react'
import Button from '@/components/ui/Button'
import CodeEditorModal from './CodeEditorModal'
import { api, setAdminToken } from '@/lib'
import { cn } from '@/lib/utils'

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'overview' | 'users' | 'suggestions'>('overview')
  const [stats, setStats] = useState<{ users: number; creations: number; suggestions: number; plaza: number; active: boolean } | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [toggling, setToggling] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [pausingId, setPausingId] = useState<number | null>(null)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pausePwdOpen, setPausePwdOpen] = useState(false)

  const loadStats = async () => {
    try {
      const r = await api.adminStats()
      setStats(r.stats)
    } catch { /* noop */ }
  }
  const loadUsers = async () => {
    try {
      const r = await api.adminUsers()
      setUsers(r.list)
    } catch { /* noop */ }
  }
  const loadSuggestions = async () => {
    try {
      const r = await api.adminSuggestions()
      setSuggestions(r.list)
    } catch { /* noop */ }
  }

  useEffect(() => {
    loadStats()
    loadUsers()
    loadSuggestions()
  }, [])

  const toggleStatus = async () => {
    if (!stats) return
    // 暂停时需要密码确认，恢复时直接执行
    if (stats.active) {
      setPausePwdOpen(true)
      return
    }
    setToggling(true)
    try {
      const r = await api.adminToggleStatus(!stats.active)
      setStats((s) => s ? { ...s, active: r.active } : s)
    } catch { /* noop */ }
    finally { setToggling(false) }
  }

  const confirmPause = async (password: string): Promise<boolean> => {
    setToggling(true)
    try {
      const r = await api.adminToggleStatus(false, password)
      setStats((s) => s ? { ...s, active: r.active } : s)
      return true
    } catch (e: any) {
      throw e
    } finally {
      setToggling(false)
    }
  }

  const toggleUserPause = async (id: number, currentPaused: boolean) => {
    setPausingId(id)
    try {
      const r = await api.adminToggleUserPause(id, !currentPaused)
      setUsers((list) => list.map((u) => u.id === id ? { ...u, paused: r.paused } : u))
    } catch (e: any) {
      alert(e.message || '操作失败')
    } finally {
      setPausingId(null)
    }
  }

  const resolveSuggestion = async (id: number) => {
    try {
      await api.adminResolveSuggestion(id)
      setSuggestions((list) => list.map((s) => s.id === id ? { ...s, resolved: true } : s))
    } catch { /* noop */ }
  }

  const doLogout = () => {
    setAdminToken(null)
    onLogout()
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* 顶栏 */}
      <header className="px-8 py-4 border-b border-line flex items-center gap-3">
        <img src="/favicon.svg" alt="logo" className="w-6 h-6 rounded" />
        <span className="font-display text-lg font-semibold">管理后台</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCodeOpen(true)}>
            <Code size={14} /> 代码编辑
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPwdOpen(true)}>
            <UserCog size={14} /> 修改名称和密码
          </Button>
          <Button variant="ghost" size="sm" onClick={doLogout}>
            <LogOut size={14} /> 退出
          </Button>
        </div>
      </header>

      <div className="px-8 py-6">
        {/* 暂停按钮 */}
        <div className="mb-6 flex items-center gap-4 p-4 rounded-2xl border border-line bg-paper">
          <div className="flex-1">
            <div className="font-semibold text-sm">软件运行状态</div>
            <div className="text-xs text-muted mt-0.5">
              {stats?.active ? '当前正常运行，用户可以访问' : '已暂停，用户只能看到维护页面'}
            </div>
          </div>
          <Button
            variant={stats?.active ? 'danger' : 'primary'}
            onClick={toggleStatus}
            loading={toggling}
            disabled={!stats}
          >
            <Power size={15} /> {stats?.active ? '暂停软件' : '恢复运行'}
          </Button>
        </div>

        {/* 标签切换 */}
        <div className="inline-flex p-1 rounded-full bg-cream border border-line mb-6">
          {([
            ['overview', '统计概览', Eye],
            ['users', '用户列表', Users],
            ['suggestions', '建议反馈', Lightbulb],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn('px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5', tab === k ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* 统计概览 */}
        {tab === 'overview' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '总用户', value: stats.users, icon: Users },
              { label: '总创作', value: stats.creations, icon: Music2 },
              { label: '建议数', value: stats.suggestions, icon: Lightbulb },
              { label: '广场作品', value: stats.plaza, icon: Eye },
            ].map((item) => (
              <div key={item.label} className="p-5 rounded-2xl border border-line bg-paper">
                <item.icon size={20} className="text-coral mb-2" />
                <div className="text-2xl font-display font-semibold">{item.value}</div>
                <div className="text-xs text-muted mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 用户列表 */}
        {tab === 'users' && (
          <div className="rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-muted text-xs">
                  <th className="text-left px-4 py-3 font-medium">用户</th>
                  <th className="text-left px-4 py-3 font-medium">手机号</th>
                  <th className="text-left px-4 py-3 font-medium">微信</th>
                  <th className="text-left px-4 py-3 font-medium">创作数</th>
                  <th className="text-left px-4 py-3 font-medium">注册时间</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">
                      {u.nickname}
                      {u.paused && (
                        <span className="ml-2 text-[11px] text-danger bg-danger/10 px-1.5 py-0.5 rounded">已暂停</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{u.phone || '—'}</td>
                    <td className="px-4 py-3 text-muted">{u.wechat || '—'}</td>
                    <td className="px-4 py-3">{u.creationCount}</td>
                    <td className="px-4 py-3 text-muted text-xs">{u.createdAt.replace('T', ' ').slice(0, 16)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleUserPause(u.id, u.paused)}
                        disabled={pausingId === u.id}
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                          u.paused
                            ? 'bg-forest/10 text-forest hover:bg-forest/20'
                            : 'bg-danger/10 text-danger hover:bg-danger/20',
                          pausingId === u.id && 'opacity-40',
                        )}
                      >
                        {u.paused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                        {u.paused ? '恢复运行' : '暂停运行'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 建议列表 */}
        {tab === 'suggestions' && (
          <div className="divide-y divide-line">
            {suggestions.length === 0 ? (
              <div className="text-center py-16 text-muted text-sm">暂无建议</div>
            ) : (
              suggestions.map((s) => (
                <div key={s.id} className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="text-sm">{s.content}</div>
                      <div className="text-xs text-muted mt-1">
                        {s.from} · {s.createdAt.replace('T', ' ').slice(0, 16)}
                      </div>
                    </div>
                    {s.resolved ? (
                      <span className="text-xs text-forest flex items-center gap-1"><Check size={12} /> 已处理</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => resolveSuggestion(s.id)}>标记已处理</Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <CodeEditorModal open={codeOpen} onClose={() => setCodeOpen(false)} />
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <PauseConfirmModal open={pausePwdOpen} onClose={() => setPausePwdOpen(false)} onConfirm={confirmPause} loading={toggling} />
    </div>
  )
}

/**
 * 修改名称和密码弹窗
 */
function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [oldName, setOldName] = useState('')
  const [newName, setNewName] = useState('')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) {
      setOldName('')
      setNewName('')
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setError('')
      setDone(false)
      setLoading(false)
    }
  }, [open])

  const submit = async () => {
    setError('')
    if (!oldPwd || !newPwd || !confirmPwd) {
      setError('请填写密码相关字段')
      return
    }
    if (newPwd.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    if (newPwd !== confirmPwd) {
      setError('两次输入的新密码不一致')
      return
    }
    setLoading(true)
    try {
      await api.adminChangePassword(oldPwd, newPwd, oldName || undefined, newName || undefined)
      setDone(true)
    } catch (e: any) {
      setError(e.message || '修改失败')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-xl w-[90%] max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <UserCog size={18} /> 修改名称和密码
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-forest/10 text-forest mb-3">
              <Check size={24} />
            </div>
            <div className="font-medium">修改成功</div>
            <div className="text-xs text-muted mt-1">下次登录请使用新名称和密码</div>
            <Button className="mt-4 w-full" onClick={onClose}>完成</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1">原名称（不修改则留空）</label>
              <input
                type="text"
                value={oldName}
                onChange={(e) => setOldName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-sm focus:outline-none focus:border-ink"
                placeholder="输入当前管理员名称"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">新名称（不修改则留空）</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-sm focus:outline-none focus:border-ink"
                placeholder="输入新的管理员名称"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">原密码</label>
              <input
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-sm focus:outline-none focus:border-ink"
                placeholder="请输入原密码"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">新密码（至少 6 位）</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-sm focus:outline-none focus:border-ink"
                placeholder="请输入新密码"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">确认新密码</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-sm focus:outline-none focus:border-ink"
                placeholder="再次输入新密码"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            {error && <div className="text-xs text-danger">{error}</div>}
            <Button className="w-full" onClick={submit} loading={loading}>
              确认修改
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 暂停软件密码确认弹窗
 */
function PauseConfirmModal({ open, onClose, onConfirm, loading }: {
  open: boolean
  onClose: () => void
  onConfirm: (password: string) => Promise<boolean>
  loading: boolean
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setPassword('')
      setError('')
    }
  }, [open])

  const submit = async () => {
    setError('')
    if (!password) {
      setError('请输入管理员密码')
      return
    }
    try {
      await onConfirm(password)
      onClose()
    } catch (e: any) {
      setError(e.message || '密码错误')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-xl w-[90%] max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Power size={18} /> 确认暂停软件
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="text-sm text-muted mb-4">
          暂停后用户将无法访问软件，请输入管理员密码确认操作。
        </div>
        <div className="space-y-3">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-sm focus:outline-none focus:border-ink"
              placeholder="请输入管理员密码"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <Button variant="danger" className="w-full" onClick={submit} loading={loading}>
            确认暂停
          </Button>
        </div>
      </div>
    </div>
  )
}
