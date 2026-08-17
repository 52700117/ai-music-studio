/**
 * 编辑歌曲页：模式选择 / 需求输入 / MP3 拖拽 / 人声 / 制作进度 / 完成
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, FileMusic, Music2, Play, X, Wand2, User, Volume2, FileAudio, AlignLeft, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import ProgressBar from '@/components/ui/ProgressBar'
import Modal from '@/components/ui/Modal'
import CompletionModal from '@/components/CompletionModal'
import { api, ApiError, setUserToken, type AudioSeed } from '@/lib'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

type Mode = 'original' | 'lyrics' | 'pure'

const MODES: { key: Mode; label: string; icon: typeof Sparkles; desc: string; ph: string }[] = [
  { key: 'original', label: '原创音乐', icon: Sparkles, desc: '', ph: '描述你想要的音乐，如：夏夜海边轻快的尤克里里民谣，温暖治愈' },
  { key: 'lyrics', label: '改编音乐', icon: FileMusic, desc: '', ph: '把完整歌词粘贴在这里，可选择男声或女声演唱' },
  { key: 'pure', label: '纯音乐', icon: Music2, desc: '', ph: '描述想要的纯音乐风格（可选），如：清晨咖啡馆的钢琴曲' },
]

export default function Editor() {
  const nav = useNavigate()
  const { user, remixSource, setRemixSource, loadPlaza } = useStore()

  const [mode, setMode] = useState<Mode>('original')
  const [prompt, setPrompt] = useState('')
  const [voice, setVoice] = useState<'male' | 'female'>('female')
  const [dragFile, setDragFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [lyricsText, setLyricsText] = useState('')
  // 歌词模式：self=自己写词，ai=AI帮写歌词
  const [lyricsMode, setLyricsMode] = useState<'self' | 'ai'>('self')
  const [aiLyricsReq, setAiLyricsReq] = useState('')
  // 音乐时长（秒）
  const [duration, setDuration] = useState(60)

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [creationId, setCreationId] = useState<number | null>(null)
  const [result, setResult] = useState<{ title: string; seed: AudioSeed; id: number; audioUrl?: string | null } | null>(null)
  const [needLogin, setNeedLogin] = useState(false)

  const pollRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 改编素材载入
  useEffect(() => {
    if (remixSource) {
      setMode('original')
      setPrompt(`基于《${remixSource.title}》（作者：${remixSource.author}）改编，保留原曲意境并加入新元素`)
    }
  }, [remixSource])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && (f.type === 'audio/mpeg' || f.type === 'audio/mp3' || f.name.toLowerCase().endsWith('.mp3'))) {
      setDragFile(f)
    } else if (f) {
      alert('请拖入 MP3 格式的音频文件')
    }
  }, [])

  const startCreate = async () => {
    if (!user) {
      setNeedLogin(true)
      return
    }
    // 原创音乐需要歌词或创作要求；改编音乐和纯音乐不强制要求顶部输入
    if (mode === 'original' && !prompt.trim() && !lyricsText.trim() && !(lyricsMode === 'ai' && aiLyricsReq.trim())) {
      alert('请填写创作要求或放入歌词')
      return
    }

    setGenerating(true)
    setProgress(0)
    setResult(null)

    const apiMode = remixSource ? 'remix' : mode
    // 合并创作要求和歌词
    // - 自己写词模式：拼接用户歌词
    // - AI帮写模式：把 AI 写词要求作为单独段落，由后端传递给 MiniMax lyrics_optimizer
    let combinedPrompt: string | undefined
    if (lyricsMode === 'ai' && mode === 'original') {
      combinedPrompt = [prompt.trim(), aiLyricsReq.trim() && `[AI写词要求]\n${aiLyricsReq.trim()}`]
        .filter(Boolean)
        .join('\n\n') || undefined
    } else {
      combinedPrompt = [prompt.trim(), lyricsText.trim() && `歌词：\n${lyricsText.trim()}`]
        .filter(Boolean)
        .join('\n\n') || undefined
    }
    try {
      const r = await api.createCreation({
        mode: apiMode,
        prompt: combinedPrompt,
        voice: mode === 'lyrics' ? voice : undefined,
        sourceSongId: remixSource?.id,
        audioName: dragFile?.name?.replace(/\.mp3$/i, '') || undefined,
        durationSec: duration,
      })
      setCreationId(r.id)
      const seed: AudioSeed = {
        mode: apiMode as AudioSeed['mode'],
        voice: (mode === 'lyrics' || mode === 'original') ? voice : undefined,
        prompt: combinedPrompt,
        lyrics: lyricsMode === 'ai' ? (aiLyricsReq.trim() || prompt.trim()) : (lyricsText.trim() || undefined),
        durationSec: duration,
      }
      // 轮询进度
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await api.getCreation(r.id)
          setProgress(s.progress)
          if (s.status === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = null
            setGenerating(false)
            setResult({ title: s.title || '无题', seed, id: r.id, audioUrl: s.audioUrl })
          }
        } catch {
          /* keep polling */
        }
      }, 600)
    } catch (e: any) {
      setGenerating(false)
      if (e instanceof ApiError && e.code === 'PAUSED') {
        useStore.getState().checkAppStatus()
      } else {
        alert(e.message || '创建失败')
      }
    }
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const onLoginSuccess = async () => {
    await useStore.getState().loadUser()
    setNeedLogin(false)
  }

  return (
    <div className="min-h-full">
      {/* 顶部标题区 */}
      <header className="px-10 pt-10 pb-6 border-b border-line">
        <div className="flex items-center gap-2 text-coral text-xs font-semibold tracking-widest uppercase mb-2">
          <Wand2 size={14} /> 编辑歌曲
        </div>
        <h1 className="font-display text-4xl font-semibold leading-tight">
          写下你的要求，<br />
          <span className="text-coral">让音乐自己长出来</span>
        </h1>
        {remixSource && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-coral-50 text-coral text-sm">
            <FileAudio size={14} />
            正在改编：《{remixSource.title}》
            <button onClick={() => { setRemixSource(null); setPrompt('') }} className="ml-1 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}
      </header>

      <div className="px-10 py-8 max-w-3xl">
        {/* 模式选择 */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          {MODES.map((m) => {
            const Icon = m.icon
            const active = mode === m.key
            return (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setDragFile(null); setDragOver(false); }}
                className={cn(
                  'p-4 rounded-2xl border text-left transition-all',
                  active ? 'border-coral bg-coral-50 shadow-soft' : 'border-line bg-paper hover:border-ink/30',
                )}
              >
                <Icon size={20} className={active ? 'text-coral' : 'text-muted'} />
                <div className={cn('mt-2 font-semibold text-sm', active && 'text-coral')}>{m.label}</div>
              </button>
            )
          })}
        </div>

        {/* 需求输入框 */}
        <label className="block mb-2 text-sm font-semibold text-ink">创作要求</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={MODES.find((m) => m.key === mode)!.ph}
          rows={5}
          className="focus-coral w-full rounded-2xl border border-line bg-cream/40 p-4 text-sm leading-relaxed resize-none placeholder:text-muted/60"
        />

        {/* 人声选择（原创音乐 & 改编音乐） */}
        {(mode === 'original' || mode === 'lyrics') && (
          <div className="mt-5">
            <label className="block mb-2 text-sm font-semibold text-ink">选择人声</label>
            <div className="inline-flex p-1 rounded-full bg-cream border border-line">
              {([['female', '女声', Volume2], ['male', '男声', User]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setVoice(v)}
                  className={cn(
                    'px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                    voice === v ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 音乐时长选择 */}
        <div className="mt-5">
          <label className="block mb-2 text-sm font-semibold text-ink">音乐时长</label>
          <div className="inline-flex p-1 rounded-full bg-cream border border-line">
            {([60, 120, 150, 180, 210] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium transition-all',
                  duration === d ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
                )}
              >
                {d}秒
              </button>
            ))}
          </div>
        </div>

        {/* 正方形区域：根据模式切换 */}
        <div className="mt-7">
          {/* 原创音乐：歌词区 */}
          {mode === 'original' && (
            <>
              {/* 歌词模式切换 */}
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm font-semibold text-ink mr-2">歌词来源</label>
                <div className="inline-flex p-1 rounded-full bg-cream border border-line">
                  <button
                    onClick={() => setLyricsMode('self')}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-xs font-medium transition-all',
                      lyricsMode === 'self' ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
                    )}
                  >
                    自己写词
                  </button>
                  <button
                    onClick={() => setLyricsMode('ai')}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-xs font-medium transition-all',
                      lyricsMode === 'ai' ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
                    )}
                  >
                    AI帮写歌词
                  </button>
                </div>
              </div>

              {/* 自己写词：歌词输入框（AI帮写时不显示） */}
              {lyricsMode === 'self' && (
                <div className="aspect-square max-w-[280px] rounded-2xl border border-coral bg-coral-50/40 flex flex-col">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-line/60">
                    <AlignLeft size={16} className="text-coral" />
                    <span className="text-sm font-medium text-ink">歌词内容</span>
                  </div>
                  <textarea
                    value={lyricsText}
                    onChange={(e) => setLyricsText(e.target.value)}
                    placeholder="在此粘贴或输入你的歌词..."
                    className="flex-1 w-full p-4 bg-transparent resize-none text-sm leading-relaxed placeholder:text-muted/50 focus:outline-none"
                  />
                </div>
              )}

              {/* AI帮写：写词要求输入框 */}
              {lyricsMode === 'ai' && (
                <div className="mt-3 max-w-[280px]">
                  <label className="block mb-2 text-xs font-medium text-muted">AI 写词要求（可选）</label>
                  <textarea
                    value={aiLyricsReq}
                    onChange={(e) => setAiLyricsReq(e.target.value)}
                    placeholder="描述歌词主题、风格、情绪，如：写一首关于夏夜海边的民谣，温暖怀旧"
                    rows={3}
                    className="focus-coral w-full rounded-2xl border border-coral bg-coral-50/40 p-3 text-sm leading-relaxed resize-none placeholder:text-muted/50"
                  />
                  <p className="mt-1.5 text-[11px] text-muted">AI 会根据你的要求自动创作歌词并演唱</p>
                </div>
              )}
            </>
          )}

          {/* 改编音乐：导入MP3音频 */}
          {mode === 'lyrics' && (
            <>
              <label className="block mb-2 text-sm font-semibold text-ink">导入MP3音频</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'aspect-square max-w-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all',
                  dragOver ? 'border-coral bg-coral-50 scale-[1.02]' : 'border-line bg-cream/40 hover:border-coral/50 hover:bg-cream',
                )}
              >
                {dragFile ? (
                  <div className="text-center px-3">
                    <FileMusic size={28} className="text-coral mx-auto mb-2" />
                    <div className="text-sm font-medium text-ink truncate">{dragFile.name}</div>
                    <div className="text-[11px] text-muted mt-1">{(dragFile.size / 1024).toFixed(0)} KB</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDragFile(null) }}
                      className="mt-2 text-xs text-muted hover:text-danger"
                    >
                      移除
                    </button>
                  </div>
                ) : (
                  <div className="text-center px-4">
                    <Upload size={26} className="text-muted mx-auto mb-2" />
                    <div className="text-sm font-medium text-ink">拖入 MP3</div>
                    <div className="text-[11px] text-muted mt-1">或点击选择文件</div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,audio/mpeg,audio/mp3"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setDragFile(f) }}
              />
            </>
          )}

          {/* 纯音乐：无额外组件 */}
        </div>

        {/* 制作按钮 */}
        <div className="mt-8">
          <Button size="lg" block onClick={startCreate} disabled={generating}>
            <Sparkles size={18} />
            {generating ? '制作中…' : remixSource ? '开始改编' : '开始制作'}
          </Button>
          {!user && (
            <p className="mt-2 text-center text-xs text-muted">
              创作需要先 <button onClick={() => setNeedLogin(true)} className="text-coral underline">登录</button>
            </p>
          )}
        </div>

        {/* 进度条弹窗：generating 时自动弹出 */}
        <Modal open={generating} onClose={() => {}} size="sm" hideClose closeOnBackdrop={false}>
          <div className="p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-coral/15 flex items-center justify-center">
                <Music2 className="text-coral animate-pulse" size={20} />
              </div>
              <div>
                <div className="font-semibold text-base">正在生成你的音乐…</div>
                <div className="text-xs text-muted mt-0.5">AI 正在谱曲、编排与混音</div>
              </div>
            </div>
            <ProgressBar progress={progress} />
            <p className="mt-4 text-center text-xs text-muted">请耐心等待，通常需要 30-90 秒</p>
          </div>
        </Modal>
      </div>

      {/* 完成弹窗 */}
      {result && (
        <CompletionModal
          open
          title={result.title}
          seed={result.seed}
          creationId={result.id}
          audioUrl={result.audioUrl}
          onClose={() => {
            setResult(null)
            setProgress(0)
            setCreationId(null)
            setPrompt('')
            setLyricsText('')
            setDragFile(null)
            setRemixSource(null)
            loadPlaza()
          }}
          onShared={loadPlaza}
        />
      )}

      {/* 登录提示弹窗 */}
      <LoginPrompt open={needLogin} onClose={() => setNeedLogin(false)} onSuccess={onLoginSuccess} nav={nav} />
    </div>
  )
}

/**
 * 未登录提示：账号密码登录 / 注册
 */
function LoginPrompt({ open, onClose, onSuccess, nav }: { open: boolean; onClose: () => void; onSuccess: () => void; nav: (p: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!username.trim()) {
      alert('请输入用户名')
      return
    }
    if (!password) {
      alert('请输入密码')
      return
    }
    setLoading(true)
    try {
      const r = mode === 'register'
        ? await api.register({ username: username.trim(), password, nickname: nickname.trim() || undefined })
        : await api.login({ username: username.trim(), password })
      setUserToken(r.token)
      await useStore.getState().loadUser()
      onSuccess()
      setUsername('')
      setPassword('')
      setNickname('')
    } catch (e: any) {
      alert(e.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="p-7">
        <h3 className="font-display text-2xl font-semibold">登录后开始创作</h3>
        <p className="mt-1 text-sm text-muted">登录后作品会保存在「我的创作」里</p>

        <div className="mt-5 inline-flex p-1 rounded-full bg-cream border border-line w-full">
          <button
            onClick={() => setMode('login')}
            className={cn('flex-1 py-1.5 rounded-full text-sm font-medium', mode === 'login' ? 'bg-ink text-paper' : 'text-muted')}
          >
            登录
          </button>
          <button
            onClick={() => setMode('register')}
            className={cn('flex-1 py-1.5 rounded-full text-sm font-medium', mode === 'register' ? 'bg-ink text-paper' : 'text-muted')}
          >
            注册新账号
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block mb-1.5 text-xs text-muted">用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^\w]/g, '').slice(0, 20))}
              placeholder="3-20 位，字母开头"
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
              placeholder="6-64 位，含字母和数字"
              className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm"
            />
          </div>

          <Button variant="primary" size="lg" block loading={loading} onClick={submit}>
            {mode === 'register' ? '注册并登录' : '登录'}
          </Button>
        </div>

        <button onClick={() => { onClose(); nav('/profile') }} className="mt-4 w-full text-center text-xs text-muted hover:text-ink">
          前往个人中心登录 →
        </button>
      </div>
    </Modal>
  )
}
