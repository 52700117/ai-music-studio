/**
 * 个人中心：微信/手机登录 / 我的创作 / 建议反馈
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Phone, MessageSquare, Music2, Send, LogOut, Check, Lightbulb, Hash,
  Download, Share2, Play,
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

  // 当前播放的创作（用于"打开音乐"）
  const [playing, setPlaying] = useState<Creation | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 打开音乐：弹窗播放
  const playCreation = (c: Creation) => {
    setPlaying(c)
  }

  // 下载
  const downloadCreation = (c: Creation) => {
    if (!c.audioUrl) {
      alert('该作品暂无音频文件，无法下载')
      return
    }
    const a = document.createElement('a')
    a.href = c.audioUrl
    a.download = `${c.title || '作品'}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // 分享
  const shareCreation = async (c: Creation) => {
    const text = `我用音乐制作工具创作了《${c.title}》，快来听听！`
    if (c.shared) {
      // 已上架：复制广场链接
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/plaza`)
        alert('已复制广场链接，可粘贴到微信/QQ 分享')
      } catch {
        alert('请手动复制：' + text)
      }
    } else {
      // 未上架：询问是否上架
      if (confirm('该作品尚未分享到广场，是否分享到广场？')) {
        try {
          await api.shareCreation(c.id)
          await loadCreations()
          await loadPlaza()
          alert('已分享到广场！')
        } catch (e: any) {
          alert(e.message || '分享失败')
        }
      } else {
        // 复制文案
        if (navigator.share) {
          navigator.share({ title: '音乐制作工具作品', text }).catch(() => {})
        } else {
          try {
            await navigator.clipboard.writeText(text)
            alert('已复制分享文案')
          } catch {
            alert('请手动复制：' + text)
          }
        }
      }
    }
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
              {user.loginType === 'password' && user.username
                ? `账号 ${user.username}`
                : user.loginType === 'phone'
                  ? `手机号 ${user.phoneMasked}`
                  : `微信 ${user.wechatMasked || '已授权'}`}
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
                      <div className="font-medium text-sm truncate flex items-center gap-2">
                        {c.title}
                        {c.shared && <span className="text-[10px] text-forest flex items-center gap-0.5"><Check size={10} />已上架</span>}
                      </div>
                      <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        <span>{MODE_LABEL[c.mode] || c.mode}</span>
                        <span>·</span>
                        {c.voice && <span>{c.voice === 'male' ? '男声' : '女声'}</span>}
                        {c.voice && <span>·</span>}
                        <span>{c.createdAt.replace('T', ' ').slice(0, 16)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => playCreation(c)}
                        title="打开音乐"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-coral/10 hover:text-coral transition-colors"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => downloadCreation(c)}
                        title="下载"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-coral/10 hover:text-coral transition-colors"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => shareCreation(c)}
                        title="分享"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-coral/10 hover:text-coral transition-colors"
                      >
                        <Share2 size={14} />
                      </button>
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

      {/* 打开音乐弹窗 */}
      {playing && (
        <Modal open onClose={() => { setPlaying(null); audioRef.current?.pause(); audioRef.current = null }} size="sm">
          <div className="p-7 text-center">
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-coral/15 flex items-center justify-center">
              <Music2 className="text-coral" size={28} />
            </div>
            <h3 className="font-display text-xl font-semibold">{playing.title}</h3>
            <div className="mt-1 text-xs text-muted">
              {MODE_LABEL[playing.mode] || playing.mode}
              {playing.voice && ` · ${playing.voice === 'male' ? '男声' : '女声'}`}
            </div>

            {playing.audioUrl ? (
              <div className="mt-5">
                <audio
                  ref={(el) => { audioRef.current = el }}
                  src={playing.audioUrl}
                  controls
                  autoPlay
                  className="w-full"
                />
                <p className="mt-3 text-xs text-muted">音频正在播放，可在此控制</p>
              </div>
            ) : (
              <div className="mt-5 p-4 rounded-xl bg-cream text-sm text-muted">
                该作品为本地合成音乐，无音频文件可播放。
                <div className="mt-2">
                  <Button variant="primary" size="sm" onClick={() => nav('/')}>去重新创作</Button>
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <Button variant="outline" size="sm" block onClick={() => { setPlaying(null); audioRef.current?.pause(); audioRef.current = null }}>
                关闭
              </Button>
              <Button variant="primary" size="sm" block onClick={() => { nav('/'); setPlaying(null); audioRef.current?.pause(); audioRef.current = null }}>
                再创作一首
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/**
 * 登录视图：账号密码注册 / 登录
 */
function LoginView({ onDone }: { onDone: () => void }) {
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(true)

  const submit = async () => {
    if (!username.trim()) {
      alert('请输入用户名')
      return
    }
    if (!password) {
      alert('请输入密码')
      return
    }
    if (!agreed) {
      alert('请先同意用户协议与隐私保护说明')
      return
    }
    setLoading(true)
    try {
      const r = mode === 'register'
        ? await api.register({ username: username.trim(), password, nickname: nickname.trim() || undefined })
        : await api.login({ username: username.trim(), password })
      setUserToken(r.token)
      await onDone()
    } catch (e: any) {
      alert(e.message || '操作失败')
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
          <p className="mt-2 text-muted text-sm">注册账号保存你的创作，并分享给朋友</p>
        </div>

        <div className="bg-paper rounded-3xl border border-line shadow-soft p-7">
          {/* 切换：登录 / 注册 */}
          <div className="inline-flex p-1 rounded-full bg-cream border border-line mb-5 w-full">
            <button
              onClick={() => setMode('login')}
              className={cn('flex-1 py-2 rounded-full text-sm font-medium', mode === 'login' ? 'bg-ink text-paper' : 'text-muted')}
            >
              登录
            </button>
            <button
              onClick={() => setMode('register')}
              className={cn('flex-1 py-2 rounded-full text-sm font-medium', mode === 'register' ? 'bg-ink text-paper' : 'text-muted')}
            >
              注册新账号
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block mb-1.5 text-xs text-muted">用户名</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^\w]/g, '').slice(0, 20))}
                placeholder="3-20 位，字母开头，仅含字母/数字/下划线"
                className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block mb-1.5 text-xs text-muted">昵称（可选）</label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 30))}
                  placeholder="不填则默认用用户名"
                  className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block mb-1.5 text-xs text-muted">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value.slice(0, 64))}
                placeholder="6-64 位，至少包含字母和数字"
                className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
              />
            </div>

            <Button variant="primary" size="lg" block loading={loading} onClick={submit}>
              {mode === 'register' ? '注册并登录' : '登录'}
            </Button>
          </div>

          <label className="mt-5 flex items-start gap-2 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-coral" />
            <span>
              我已阅读并同意<span className="text-coral">《用户协议》</span>与<span className="text-coral">《隐私保护说明》</span>，
              账号信息将被加密存储，仅本人可见。
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
