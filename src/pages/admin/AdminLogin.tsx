/**
 * 管理员登录页（严格模式：每次打开必须输账号密码，不记住任何登录态）
 */
import { useState } from 'react'
import { Lock } from 'lucide-react'
import Button from '@/components/ui/Button'
import { api, clearAdminAuth, setAdminToken } from '@/lib'

export default function AdminLogin({ onDone }: { onDone: () => void }) {
  // 严格模式：每次打开页面默认空，不记住用户名
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!username.trim() || !password.trim()) {
      setErr('请输入账号和密码')
      return
    }
    setLoading(true)
    setErr('')
    try {
      // 先清一次任何残留登录态，保证每次登录都是干净的
      clearAdminAuth()
      const r = await api.adminLogin(username.trim(), password.trim())
      setAdminToken(r.token)
      onDone()
    } catch (e: any) {
      setErr(e.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper-grain flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-ink items-center justify-center mb-4 overflow-hidden">
            <img src="/favicon.svg" alt="logo" className="w-9 h-9" />
          </div>
          <h1 className="font-display text-3xl font-semibold">管理后台</h1>
          <p className="mt-2 text-muted text-sm">仅限管理员登录</p>
        </div>

        <div className="bg-paper rounded-3xl border border-line shadow-soft p-7 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="管理员账号"
            className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            type="password"
            placeholder="密码"
            className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
          />
          {err && <div className="text-sm text-danger">{err}</div>}
          <Button variant="primary" size="lg" block loading={loading} onClick={submit}>
            <Lock size={16} /> 登录
          </Button>
          <div className="text-xs text-muted text-center mt-2">演示账号：admin / admin123</div>
        </div>
      </div>
    </div>
  )
}
