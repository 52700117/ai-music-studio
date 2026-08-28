/**
 * 个人中心：三个标签页（我的作品/创作历史/个人信息）+ 右上角功能按钮
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, LogOut, Search, Music2, History, Settings, Lock, Send, Check,
  Download, Share2, Play, Loader2, Edit3, ChevronRight, X, Sparkles,
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

const GENDER_LABEL: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他',
}

type TabKey = 'works' | 'history' | 'info'

export default function Profile() {
  const nav = useNavigate()
  const { user, loadUser, logout, loadPlaza } = useStore()
  const [tab, setTab] = useState<TabKey>('works')
  const [creations, setCreations] = useState<Creation[]>([])
  const [search, setSearch] = useState('')
  const [suggestSent, setSuggestSent] = useState(false)
  const [suggestion, setSuggestion] = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [suggestModalOpen, setSuggestModalOpen] = useState(false)

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

  // 过滤后的列表
  const filteredList = creations.filter((c) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      c.title?.toLowerCase().includes(q) ||
      c.prompt?.toLowerCase().includes(q) ||
      (MODE_LABEL[c.mode] || c.mode).toLowerCase().includes(q)
    )
  })

  // "我的作品"：只显示已完成
  const worksList = filteredList.filter((c) => c.status === 'completed')
  // "创作历史"：显示全部
  const historyList = filteredList

  const submitSuggestion = async () => {
    if (!suggestion.trim()) return
    setSuggestLoading(true)
    try {
      await api.submitSuggestion(suggestion.trim())
      setSuggestion('')
      setSuggestSent(true)
      setTimeout(() => {
        setSuggestSent(false)
        setSuggestModalOpen(false)
      }, 1500)
    } catch (e: any) {
      alert(e.message || '提交失败')
    } finally {
      setSuggestLoading(false)
    }
  }

  const doLogout = () => {
    logout()
    setCreations([])
    nav('/')
  }

  // 当前播放的创作
  const [playing, setPlaying] = useState<Creation | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playCreation = (c: Creation) => setPlaying(c)

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

  const shareCreation = async (c: Creation) => {
    const text = `我用音乐制作工具创作了《${c.title}》，快来听听！`
    if (c.shared) {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/plaza`)
        alert('已复制广场链接，可粘贴到微信/QQ 分享')
      } catch {
        alert('请手动复制：' + text)
      }
    } else {
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
      {/* 顶部 */}
      <header className="px-10 pt-10 pb-6 border-b border-line">
        <div className="flex items-center gap-4">
          {/* 头像 */}
          <div className="w-16 h-16 rounded-full bg-coral/15 flex items-center justify-center text-coral font-display text-2xl font-semibold overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt="头像" className="w-full h-full object-cover" />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-3xl font-semibold">{user.nickname}</h1>
            <div className="text-sm text-muted mt-0.5">
              {user.loginType === 'password' && user.username
                ? `账号 ${user.username}`
                : user.loginType === 'phone'
                  ? `手机号 ${user.phoneMasked}`
                  : `微信 ${user.wechatMasked || '已授权'}`}
            </div>
          </div>
          {/* 退出按钮 */}
          <Button variant="ghost" size="sm" onClick={doLogout}>
            <LogOut size={16} /> 退出
          </Button>
        </div>
      </header>

      <div className="px-10 py-8">
        {/* 标签 + 右侧功能按钮 */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          {/* 三个标签页 */}
          <div className="inline-flex gap-1">
            {([
              { key: 'works', label: '我的作品', icon: Music2 },
              { key: 'history', label: '创作历史', icon: History },
              { key: 'info', label: '个人信息', icon: Settings },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all',
                  tab === key
                    ? 'bg-ink text-paper shadow-sm'
                    : 'text-muted hover:text-ink hover:bg-cream',
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* 右侧功能按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPwdModalOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 text-muted hover:text-ink hover:bg-cream transition-colors"
            >
              <Lock size={14} /> 修改密码
            </button>
            <button
              onClick={() => setSuggestModalOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 text-muted hover:text-ink hover:bg-cream transition-colors"
            >
              <Sparkles size={14} /> 建议反馈
            </button>
          </div>
        </div>

        {/* ==== 我的作品 tab ==== */}
        {tab === 'works' && <CreationList
          items={worksList}
          search={search}
          onSearch={setSearch}
          onPlay={playCreation}
          onDownload={downloadCreation}
          onShare={shareCreation}
          emptyText="还没有作品"
          onGoCreate={() => nav('/')}
          user={user}
        />}

        {/* ==== 创作历史 tab ==== */}
        {tab === 'history' && <CreationList
          items={historyList}
          search={search}
          onSearch={setSearch}
          onPlay={playCreation}
          onDownload={downloadCreation}
          onShare={shareCreation}
          showStatus
          emptyText="还没有创作历史"
          onGoCreate={() => nav('/')}
          user={user}
        />}

        {/* ==== 个人信息 tab ==== */}
        {tab === 'info' && <PersonalInfo user={user} onUpdate={async () => { await loadUser(); await loadCreations() }} />}
      </div>

      {/* 播放弹窗 */}
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
              </div>
            ) : (
              <div className="mt-5 p-4 rounded-xl bg-cream text-sm text-muted">
                该作品暂无音频文件，可重新创作
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 修改密码弹窗 */}
      {pwdModalOpen && (
        <ChangePasswordModal onClose={() => setPwdModalOpen(false)} />
      )}

      {/* 建议反馈弹窗 */}
      {suggestModalOpen && (
        <Modal open onClose={() => { if (!suggestLoading) setSuggestModalOpen(false) }} size="md">
          <div className="p-7">
            <h3 className="font-display text-xl font-semibold mb-2">建议反馈</h3>
            <p className="text-sm text-muted mb-4">你的每一条建议都会被认真对待（匿名提交）。</p>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value.slice(0, 500))}
              rows={6}
              placeholder="功能、体验、问题都可以写在这里…"
              className="focus-coral w-full rounded-2xl border border-line bg-cream/40 p-4 text-sm resize-none placeholder:text-muted/60"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted">{suggestion.length}/500</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSuggestModalOpen(false)} disabled={suggestLoading}>
                  取消
                </Button>
                <Button onClick={submitSuggestion} loading={suggestLoading} disabled={!suggestion.trim()} size="sm">
                  <Send size={14} /> 提交建议
                </Button>
              </div>
            </div>
            {suggestSent && (
              <div className="mt-3 flex items-center gap-2 text-forest text-sm animate-slide-up">
                <Check size={15} /> 已收到，感谢你的反馈！
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ==================== 创作列表组件 ==================== */
function CreationList({
  items, search, onSearch, onPlay, onDownload, onShare, showStatus, emptyText, onGoCreate,
}: {
  items: Creation[]
  search: string
  onSearch: (v: string) => void
  onPlay: (c: Creation) => void
  onDownload: (c: Creation) => void
  onShare: (c: Creation) => void
  showStatus?: boolean
  emptyText: string
  onGoCreate: () => void
  user: any
}) {
  return (
    <div>
      {/* 搜索框 */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索作品标题或创作要求…"
          className="focus-coral w-full rounded-full border border-line bg-cream/40 pl-11 pr-10 py-3 text-sm placeholder:text-muted/60"
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-muted hover:bg-line hover:text-ink transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <Music2 size={40} className="mx-auto mb-4 opacity-30" />
          <div className="text-lg font-medium">{emptyText}</div>
          <div className="mt-2 text-sm opacity-70">开始你的第一首创作吧</div>
          <div className="mt-6">
            <Button variant="primary" onClick={onGoCreate}>
              <Sparkles size={16} /> 去创作
            </Button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((c) => (
            <CreationRow
              key={c.id}
              creation={c}
              onPlay={onPlay}
              onDownload={onDownload}
              onShare={onShare}
              showStatus={showStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CreationRow({
  creation: c, onPlay, onDownload, onShare, showStatus,
}: {
  creation: Creation
  onPlay: (c: Creation) => void
  onDownload: (c: Creation) => void
  onShare: (c: Creation) => void
  showStatus?: boolean
}) {
  const isProcessing = c.status === 'processing'
  const isFailed = c.status === 'failed'

  return (
    <div className="flex items-center gap-4 py-4 hover:bg-cream/40 transition-colors -mx-3 px-3 rounded-xl group">
      {/* 左侧图标 */}
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
        isProcessing ? 'bg-amber-100' : isFailed ? 'bg-red-100' : 'bg-coral/10',
      )}>
        {isProcessing ? (
          <Loader2 size={18} className="text-amber-600 animate-spin" />
        ) : isFailed ? (
          <X size={18} className="text-red-500" />
        ) : (
          <Music2 size={18} className="text-coral" />
        )}
      </div>

      {/* 中间信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate flex items-center gap-2">
          {c.title}
          {c.shared && <span className="text-[10px] text-forest flex items-center gap-0.5"><Check size={10} />已上架</span>}
          {showStatus && isProcessing && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">处理中</span>}
          {showStatus && isFailed && <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">失败</span>}
        </div>
        <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
          <span>{MODE_LABEL[c.mode] || c.mode}</span>
          <span>·</span>
          {c.voice && <>{c.voice === 'male' ? '男声' : '女声'}<span>·</span></>}
          <span>{c.createdAt.replace('T', ' ').slice(0, 16)}</span>
        </div>
      </div>

      {/* 右侧操作（只有 completed 状态才显示） */}
      {c.status === 'completed' ? (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onPlay(c)} title="播放" className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-coral/10 hover:text-coral transition-colors">
            <Play size={15} />
          </button>
          <button onClick={() => onDownload(c)} title="下载" className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-coral/10 hover:text-coral transition-colors">
            <Download size={15} />
          </button>
          <button onClick={() => onShare(c)} title="分享" className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-coral/10 hover:text-coral transition-colors">
            <Share2 size={15} />
          </button>
        </div>
      ) : (
        <div className="flex-shrink-0 text-xs text-muted">
          {isProcessing ? '生成中…' : '无法操作'}
        </div>
      )}
    </div>
  )
}

/* ==================== 个人信息组件 ==================== */
function PersonalInfo({ user, onUpdate }: { user: any; onUpdate: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [editField, setEditField] = useState<string | null>(null)
  const [bio, setBio] = useState(user.bio || '')
  const [nickname, setNickname] = useState(user.nickname || '')
  const [gender, setGender] = useState(user.gender || '')
  const [avatar, setAvatar] = useState(user.avatar || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.updateProfile({ nickname, bio, gender: gender || undefined, avatar })
      await onUpdate()
      setEditing(false)
      setEditField(null)
    } catch (e: any) {
      alert(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('头像不能超过 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatar(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const bindPhone = () => {
    alert('绑定手机号功能开发中')
  }
  const bindWechat = () => {
    alert('绑定微信功能开发中')
  }

  return (
    <div className="max-w-2xl">
      {/* 头像 */}
      <div className="flex flex-col items-center mb-8">
        <label className="cursor-pointer group">
          <div className="w-24 h-24 rounded-full bg-coral/15 flex items-center justify-center text-coral overflow-hidden ring-4 ring-transparent group-hover:ring-coral/20 transition-all">
            {avatar ? (
              <img src={avatar} alt="头像" className="w-full h-full object-cover" />
            ) : (
              <User size={40} />
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        </label>
        <div className="mt-3 text-sm text-muted">点击更换头像</div>
        {avatar && (
          <div className="mt-2 flex gap-2">
            <Button variant="primary" size="sm" onClick={save} loading={saving}>保存头像</Button>
            <Button variant="outline" size="sm" onClick={() => setAvatar('')}>移除</Button>
          </div>
        )}
      </div>

      {/* 信息列表 */}
      <div className="space-y-1 bg-paper rounded-2xl border border-line overflow-hidden mb-6">
        {/* 昵称 */}
        <InfoRow
          label="昵称"
          value={nickname}
          editable
          isEditing={editField === 'nickname'}
          onEdit={() => { setEditField('nickname'); setNickname(user.nickname) }}
          onCancel={() => { setEditField(null); setNickname(user.nickname) }}
          onSave={async () => { setEditField(null); await save() }}
        >
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 30))}
            placeholder="输入昵称"
            className="focus-coral w-full rounded-lg border border-line bg-cream/40 px-3 py-2 text-sm"
          />
        </InfoRow>

        {/* 简介 */}
        <InfoRow
          label="简介"
          value={user.bio ? user.bio : '介绍你的音乐与故事'}
          valueClass={user.bio ? '' : 'text-muted'}
          editable
          isEditing={editField === 'bio'}
          onEdit={() => { setEditField('bio'); setBio(user.bio || '') }}
          onCancel={() => { setEditField(null); setBio(user.bio || '') }}
          onSave={async () => { setEditField(null); await save() }}
        >
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="介绍你的音乐与故事…"
            className="focus-coral w-full rounded-lg border border-line bg-cream/40 px-3 py-2 text-sm resize-none"
          />
        </InfoRow>

        {/* 性别 */}
        <InfoRow
          label="性别"
          value={gender ? GENDER_LABEL[gender] : ''}
          valueClass={gender ? '' : 'text-muted'}
          editable
          isEditing={editField === 'gender'}
          onEdit={() => { setEditField('gender'); setGender(user.gender || '') }}
          onCancel={() => { setEditField(null); setGender(user.gender || '') }}
          onSave={async () => { setEditField(null); await save() }}
        >
          <div className="flex gap-2">
            {[
              { v: 'male', label: '男' },
              { v: 'female', label: '女' },
              { v: 'other', label: '其他' },
            ].map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setGender(v)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm border transition-colors',
                  gender === v
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-cream/40 border-line hover:bg-cream',
                )}
              >
                {label}
              </button>
            ))}
            {gender && (
              <button onClick={() => setGender('')} className="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink">
                清除
              </button>
            )}
          </div>
        </InfoRow>

        {/* Novunio ID */}
        <div className="flex items-center px-5 py-4 border-b border-line/50 last:border-0">
          <span className="text-sm font-medium w-28 flex-shrink-0">Novunio ID</span>
          <span className="text-sm text-muted flex-1">NX{String(user.id).padStart(6, '0')}</span>
        </div>
      </div>

      {/* 绑定区块 */}
      <div className="space-y-1 bg-paper rounded-2xl border border-line overflow-hidden">
        {/* 绑定手机号 */}
        <div className="flex items-center px-5 py-4 border-b border-line/50 last:border-0">
          <span className="text-sm font-medium w-28 flex-shrink-0">绑定手机号</span>
          <span className="text-sm text-muted flex-1">
            {user.phoneMasked || '未绑定'}
          </span>
          <button
            onClick={bindPhone}
            className="text-sm text-coral hover:underline flex items-center gap-0.5"
          >
            {user.phoneMasked ? '更换' : '去绑定'} <ChevronRight size={14} />
          </button>
        </div>

        {/* 绑定微信 */}
        <div className="flex items-center px-5 py-4">
          <span className="text-sm font-medium w-28 flex-shrink-0">绑定微信</span>
          <span className="text-sm text-muted flex-1">
            {user.wechatMasked || '未绑定'}
          </span>
          <button
            onClick={bindWechat}
            className="text-sm text-coral hover:underline flex items-center gap-0.5"
          >
            {user.wechatMasked ? '更换' : '去绑定'} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label, value, valueClass = '', editable, isEditing, onEdit, onCancel, onSave, children,
}: {
  label: string
  value: string
  valueClass?: string
  editable?: boolean
  isEditing?: boolean
  onEdit?: () => void
  onCancel?: () => void
  onSave?: () => Promise<void>
  children?: React.ReactNode
}) {
  if (isEditing) {
    return (
      <div className="px-5 py-4 border-b border-line/50 last:border-0">
        <div className="text-xs text-muted mb-2">{label}</div>
        {children}
        <div className="flex gap-2 mt-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-muted hover:text-ink rounded-lg hover:bg-cream">
            取消
          </button>
          <button onClick={onSave} className="px-3 py-1.5 text-sm bg-ink text-paper rounded-lg hover:opacity-90">
            保存
          </button>
        </div>
      </div>
    )
  }
  return (
    <button
      onClick={onEdit}
      disabled={!editable}
      className={cn(
        'w-full flex items-center px-5 py-4 border-b border-line/50 last:border-0 text-left transition-colors',
        editable && 'hover:bg-cream/60 cursor-pointer',
      )}
    >
      <span className="text-sm font-medium w-28 flex-shrink-0">{label}</span>
      <span className={cn('text-sm flex-1 truncate', valueClass || 'text-ink')}>
        {value || '-'}
      </span>
      {editable && <Edit3 size={14} className="text-muted flex-shrink-0" />}
    </button>
  )
}

/* ==================== 修改密码弹窗 ==================== */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!oldPwd) { alert('请输入旧密码'); return }
    if (!newPwd) { alert('请输入新密码'); return }
    if (newPwd !== confirmPwd) { alert('两次输入的新密码不一致'); return }
    setLoading(true)
    try {
      await api.changeUserPassword(oldPwd, newPwd)
      alert('密码修改成功')
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
      onClose()
    } catch (e: any) {
      alert(e.message || '修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={() => { if (!loading) onClose() }} size="sm">
      <div className="p-7">
        <h3 className="font-display text-xl font-semibold mb-1">修改密码</h3>
        <p className="text-sm text-muted mb-5">请输入旧密码以验证身份</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">旧密码</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="请输入你当前使用的密码"
              className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">新密码</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="请输入 6-64 位新密码"
              className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">确认新密码</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="请再次输入新密码"
              className="focus-coral w-full rounded-xl border border-line bg-cream/40 px-4 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" block onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button variant="primary" block loading={loading} onClick={handleSubmit}>
            确认修改
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ==================== 登录视图 ==================== */
function LoginView({ onDone }: { onDone: () => void }) {
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(true)

  const submit = async () => {
    if (!username.trim()) { alert('请输入用户名'); return }
    if (!password) { alert('请输入密码'); return }
    if (!agreed) { alert('请先同意用户协议'); return }
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
              我已阅读并同意<span className="text-coral">《用户协议》</span>与<span className="text-coral">《隐私保护说明》</span>。
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
