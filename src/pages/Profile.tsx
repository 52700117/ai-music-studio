/**
 * 个人中心：微信/手机登录 / 我的创作 / 建议反馈
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Phone, MessageSquare, Music2, Send, LogOut, Check, Lightbulb, Hash,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { api, setUserToken, type Creation } from '@/lib'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const MODE_LABEL: Record<string, string> = {
  original: '原创音乐',
  lyrics: '改编音乐',
  pure: '纯音乐',
  remix: '改编',
}

export default function Profile() {
  const nav = useNavigate()
  const { user, loadUser, logout, loadPlaza } = useStore()
  const [tab, setTab] = useState<'creations' | 'suggest'>('creations')
  const [creations, setCreations] = useState<Creation[]>([])
  const [suggestion, setSuggestion] = useState('')
  const [suggestSent, setSuggestSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadCreations = async () => {
    if (!user) return
    try {
      const r = await api.myCreations()
      setCreations(r.list)
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    if (user) loadCreations()
  }, [user])

  const submitSuggestion = async () => {
    if (!suggestion.trim()) return
    setLoading(true)
    try {
      await api.submitSuggestion(suggestion.trim())
      setSuggestion('')
      setSuggestSent(true)
      setTimeout(() => setSuggestSent(false), 2500)
    } catch (e: any) {
      alert(e.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  const doLogout = () => {
    logout()
    setCreations([])
    nav('/')
  }

  if (!user) return <LoginView onDone={() => loadUser()} />

  return (
    <div className="min-h-full">
      <header className="px-10 pt-10 pb-6 border-b border-line">
        <div className="flex items-center gap-2 text-coral text-xs font-semibold tracking-widest uppercase mb-2">
          <User size={14} /> 个人中心
        </div>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-coral/15 flex items-center justify-center text-coral font-display text-2xl font-semibold">
            {user.nickname.slice(0, 1)}
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">{user.nickname}</h1>
            <div className="text-sm text-muted mt-0.5">
              {user.loginType === 'phone' ? `手机号 ${user.phoneMasked}` : `微信 ${user.wechatMasked || '已授权'}`}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={doLogout}>
              <LogOut size={14} /> 退出
            </Button>
          </div>
        </div>
      </header>

      <div className="px-10 py-8">
        {/* 标签切换 */}
        <div className="inline-flex p-1 rounded-full bg-cream border border-line mb-6">
          <button
            onClick={() => setTab('creations')}
            className={cn('px-5 py-2 rounded-full text-sm font-medium flex items-center gap-1.5', tab === 'creations' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}
          >
            <Music2 size={14} /> 我的创作
          </button>
          <button
            onClick={() => setTab('suggest')}
            className={cn('px-5 py-2 rounded-full text-sm font-medium flex items-center gap-1.5', tab === 'suggest' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}
          >
            <Lightbulb size={14} /> 建议反馈
          </button>
        </div>

        {tab === 'creations' && (
          <div>
            {creations.length === 0 ? (
              <div className="text-center py-16 text-muted">
                <Music2 size={32} className="mx-auto mb-3 opacity-40" />
                还没有创作，去写第一首吧
                <div className="mt-4">
                  <Button variant="primary" size="sm" onClick={() => nav('/')}>开始创作</Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {creations.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 py-3.5 hover:bg-cream/40 transition-colors -mx-2 px-2 rounded-xl">
                    <div className="w-9 h-9 rounded-lg bg-coral/10 flex items-center justify-center flex-shrink-0">
                      <Music2 size={16} className="text-coral" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.title}</div>
                      <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        <span>{MODE_LABEL[c.mode] || c.mode}</span>
                        <span>·</span>
                        {c.voice && <span>{c.voice === 'male' ? '男声' : '女声'}</span>}
                        {c.voice && <span>·</span>}
                        <span>{c.createdAt.replace('T', ' ').slice(0, 16)}</span>
                      </div>
                    </div>
                    <div className="text-xs">
                      {c.shared ? (
                        <span className="text-forest flex items-center gap-1"><Check size={12} /> 已上架</span>
                      ) : (
                        <span className="text-muted">仅自己</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'suggest' && (
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={16} className="text-coral" />
              <h3 className="font-semibold text-sm">告诉我们你的建议</h3>
            </div>
            <p className="text-sm text-muted mb-4">你的每一条建议都会被认真对待（匿名提交）。</p>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              rows={5}
              placeholder="功能、体验、问题都可以写在这里…"
              className="focus-coral w-full rounded-2xl border border-line bg-cream/40 p-4 text-sm resize-none placeholder:text-muted/60"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted">{suggestion.length}/1000</span>
              <Button onClick={submitSuggestion} loading={loading} disabled={!suggestion.trim()}>
                <Send size={15} /> 提交建议
              </Button>
            </div>
            {suggestSent && (
              <div className="mt-3 flex items-center gap-2 text-forest text-sm animate-slide-up">
                <Check size={15} /> 已收到，感谢你的反馈！
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 登录视图
 */
function LoginView({ onDone }: { onDone: () => void }) {
  const nav = useNavigate()
  const [type, setType] = useState<'phone' | 'wechat'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(true)

  const submit = async () => {
    if (type === 'phone' && !/^\d{11}$/.test(phone)) {
      alert('请输入 11 位手机号')
      return
    }
    if (!agreed) {
      alert('请先同意隐私保护说明')
      return
    }
    setLoading(true)
    try {
      const r = await api.login({
        type,
        phone: type === 'phone' ? phone : undefined,
        code: type === 'phone' ? code || '1234' : 'wx_demo_auth',
        nickname: type === 'wechat' ? `微信用户${Math.floor(Math.random() * 9000) + 1000}` : undefined,
      })
      setUserToken(r.token)
      await onDone()
    } catch (e: any) {
      alert(e.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-paper-grain flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-ink items-center justify-center mb-4">
            <Music2 className="text-coral" size={26} />
          </div>
          <h1 className="font-display text-3xl font-semibold">欢迎使用音乐制作工具</h1>
          <p className="mt-2 text-muted text-sm">登录后保存你的创作，并分享给朋友</p>
        </div>

        <div className="bg-paper rounded-3xl border border-line shadow-soft p-7">
          <div className="inline-flex p-1 rounded-full bg-cream border border-line mb-5 w-full">
            <button
              onClick={() => setType('phone')}
              className={cn('flex-1 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-1.5', type === 'phone' ? 'bg-ink text-paper' : 'text-muted')}
            >
              <Phone size={14} /> 手机号
            </button>
            <button
              onClick={() => setType('wechat')}
              className={cn('flex-1 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-1.5', type === 'wechat' ? 'bg-ink text-paper' : 'text-muted')}
            >
              <Hash size={14} /> 微信
            </button>
          </div>

          {type === 'phone' ? (
            <div className="space-y-3">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="手机号"
                className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
              />
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 6))}
                  placeholder="验证码"
                  className="focus-coral flex-1 rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
                />
                <Button variant="outline" size="md" onClick={() => setCode('1234')}>获取验证码</Button>
              </div>
              <Button variant="primary" size="lg" block loading={loading} onClick={submit}>登录</Button>
            </div>
          ) : (
            <div>
              <Button variant="wechat" size="lg" block loading={loading} onClick={submit}>
                <Hash size={16} /> 微信一键登录
              </Button>
              <p className="mt-2 text-center text-xs text-muted">演示环境将模拟微信授权</p>
            </div>
          )}

          <label className="mt-5 flex items-start gap-2 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-coral" />
            <span>
              我已阅读并同意<span className="text-coral">《用户协议》</span>与<span className="text-coral">《隐私保护说明》</span>，
              我的手机号与微信信息将被加密存储，仅本人可见。
            </span>
          </label>
        </div>

        <button onClick={() => nav('/')} className="mt-4 w-full text-center text-sm text-muted hover:text-ink">
          ← 先逛逛再说
        </button>
      </div>
    </div>
  )
}
