/**
 * 官方下载页：展示 Win/Mac 安装包 + 云端版快捷入口 + 使用步骤
 * - 启动时先调 /api/dl-debug 拿 release 目录的真实文件列表，release 里不存在的包
 *   直接标为"暂未开放"并禁用下载按钮，避免 UI 承诺存在、实际 404 被兜成 index.html，
 *   让用户下载到假 zip 解压时提示"压缩文件格式未知或者数据已经被损坏"。
 */
import { Download, Monitor, Cloud, ArrowRight, Check, Apple, ChevronRight, ExternalLink, AlertTriangle, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface PackageItem {
  os: 'installer-win' | 'windows' | 'mac-x64' | 'mac-arm' | 'src-win' | 'src-mac'
  name: string
  desc: string
  icon: any
  filename: string
  tag?: string
  recommended?: boolean
}

interface ReleaseFile {
  name: string
  size: number
  isFile: boolean
}

interface DlDebugResp {
  files?: ReleaseFile[]
  releaseDir?: string
  exists?: boolean
}

// 支持上架的完整清单（当前 release 目录里有哪个就给哪个启用）
// 注意：源码一键版在任何情况下都是可用的，作为兜底方案
const PACKAGES: PackageItem[] = [
  {
    os: 'installer-win',
    name: 'Windows 一键安装版',
    desc: '双击安装，桌面自动出现图标，点击即用。无需 Node.js',
    icon: Monitor,
    filename: 'music-app-windows-installer.exe',
    tag: '推荐',
    recommended: true,
  },
  {
    os: 'src-win',
    name: 'Windows 源码一键版',
    desc: '双击 一键启动.bat，自动安装并启动（需 Node.js 18+）',
    icon: Monitor,
    filename: 'music-app-all-in-one-src-windows.zip',
  },
  {
    os: 'src-mac',
    name: 'macOS 源码一键版',
    desc: '双击 一键启动.command，自动安装并启动（需 Node.js 18+）',
    icon: Apple,
    filename: 'music-app-all-in-one-src-mac.zip',
    tag: '推荐',
    recommended: true,
  },
  {
    os: 'mac-arm',
    name: 'macOS Apple Silicon 版',
    desc: 'M1/M2/M3/M4 芯片，免安装无需 Node.js',
    icon: Apple,
    filename: 'music-app-mac-arm.zip',
  },
  {
    os: 'mac-x64',
    name: 'macOS Intel 版',
    desc: 'Intel 芯片 Mac，免安装无需 Node.js',
    icon: Apple,
    filename: 'music-app-mac-x64.zip',
  },
]

const STEPS = [
  { num: 1, title: '下载安装程序', desc: '点击上方「Windows 一键安装版」下载按钮，获取安装程序（约 24MB）。' },
  { num: 2, title: '双击安装', desc: '双击下载的安装程序，按提示完成安装（如提示 SmartScreen，点击「更多信息」→「仍要运行」）。' },
  { num: 3, title: '桌面打开软件', desc: '安装完成后桌面会出现「音乐创作软件」图标，双击即可启动软件窗口。' },
  { num: 4, title: '开始创作', desc: '稍等几秒软件就会加载完成，注册登录后即可开始创作音乐！' },
]

const FAQ = [
  {
    q: '需要安装 Node.js 吗？',
    a: '一键安装版（music-app-windows-installer.exe）已内置完整运行环境，不需要额外安装任何东西。源码一键版需要先安装 Node.js 18+。',
  },
  {
    q: '电脑可以关机吗？关机后还能用吗？',
    a: '软件安装在你自己的电脑上，随时可以关机。想用的时候再双击启动就可以了，数据都保存在本地。',
  },
  {
    q: '别人怎么访问我的音乐软件？',
    a: '方法一：把安装包发给对方，让他自己在电脑上安装运行。方法二：你电脑运行软件时，使用内网穿透（localtunnel / ngrok / 飞鸽）获取公网域名分享给朋友。',
  },
  {
    q: '我的音乐作品数据存在哪？',
    a: '所有用户账号、作品数据、生成的音乐都保存在本地的 SQLite 数据库里（软件目录下 data/app.db），不会上传到任何第三方。',
  },
  {
    q: '为什么 SmartScreen 提示风险？',
    a: '因为我们没有购买微软数字签名（每年需几千元费用），这是正常提示。请点击「更多信息」→「仍要运行」即可放心使用，软件完全开源无毒。',
  },
]

function formatSize(n?: number): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function DownloadPage() {
  const [search, setSearch] = useSearchParams()
  const [release, setRelease] = useState<DlDebugResp | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(true)
  // 服务端 302 跳回来时携带的下载错误：?dl_error=not_found&dl_file=xxx
  const dlError = search.get('dl_error')
  const dlFile = search.get('dl_file')
  const [dismissDlError, setDismissDlError] = useState(false)
  const showDlError =
    !dismissDlError &&
    (dlError === 'not_found' || (dlError && dlError.length > 0))
  const clearDlError = () => {
    setDismissDlError(true)
    const next = new URLSearchParams(search)
    next.delete('dl_error')
    next.delete('dl_file')
    setSearch(next, { replace: true })
  }

  // 拉取 release 目录真实文件列表，防止 UI 推荐不存在的包（比如 music-app-windows.zip）
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(`/api/dl-debug?_=${Date.now()}`, { cache: 'no-store' })
        if (!resp.ok) throw new Error(`status ${resp.status}`)
        const data = await resp.json() as DlDebugResp
        if (!cancelled) setRelease(data)
      } catch (err) {
        console.warn('[download] fetch dl-debug failed', err)
        if (!cancelled) setRelease({ exists: false, files: [] })
      } finally {
        if (!cancelled) setLoadingFiles(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const availableNames = useMemo(() => {
    const set = new Set<string>()
    if (release?.files) {
      for (const f of release.files) if (f.isFile) set.add(f.name)
    }
    return set
  }, [release])

  const sizeOf = (filename: string): number | undefined =>
    release?.files?.find(f => f.isFile && f.name === filename)?.size

  const handleDownload = (pkg: PackageItem) => {
    const available = availableNames.has(pkg.filename)
    if (!available) {
      alert('该版本正在重新打包上传，暂时无法下载，请选择下方的「源码一键版」，功能完全一致！')
      return
    }
    const url = `/dl/${pkg.filename}`
    const a = document.createElement('a')
    a.href = url
    a.download = pkg.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-full">
      {/* 下载失败回跳提示横幅 */}
      {showDlError && (
        <div className="mx-5 mt-4 rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 flex items-start gap-3 shadow-soft">
          <div className="w-10 h-10 rounded-xl bg-coral/15 text-coral flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink leading-tight">
              抱歉，「{dlFile || '该安装包'}」暂时未开放下载
            </div>
            <div className="mt-1 text-xs text-muted leading-relaxed">
              免安装 pkg 桌面版（无需 Node.js）正在重新打包上传中，目前请直接下载下方【推荐】的「源码一键版」，
              功能和桌面版完全一致，只需你电脑安装 Node.js 18+（首次启动会自动装依赖和构建，
              <a href="https://nodejs.org/zh-cn" target="_blank" rel="noreferrer" className="text-ocean underline underline-offset-2 mx-0.5">点这里安装 Node.js</a>）。
            </div>
            <a href="#downloads" className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ocean">
              去选择源码一键版 <ChevronRight size={12} />
            </a>
          </div>
          <button
            onClick={clearDlError}
            className="w-8 h-8 rounded-lg text-muted hover:bg-coral/10 hover:text-ink flex items-center justify-center flex-shrink-0"
            aria-label="关闭"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Hero 区 */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-coral/5 via-transparent to-ocean/5" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-coral/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-ocean/10 blur-3xl" />
        <div className="relative px-10 pt-14 pb-16">
          <div className="flex items-center gap-2 text-coral text-xs font-semibold tracking-widest uppercase mb-3">
            <Download size={14} /> 下载中心
          </div>
          <h1 className="font-display text-5xl font-semibold leading-tight">
            把音乐创作工具，<br />
            <span className="text-coral">装到你自己的电脑上</span>
          </h1>
          <p className="mt-4 text-muted text-base max-w-xl">
            Windows 和 macOS 均支持免安装版本，解压即用。
            内置 MiniMax Music 3.0 AI 模型，离线也能管理你的音乐作品。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#downloads">
              <Button variant="primary" size="lg">
                <Download size={18} />
                立即下载
                <ArrowRight size={16} />
              </Button>
            </a>
            <a href="/" target="_blank" rel="noreferrer">
              <Button variant="outline" size="lg">
                <Cloud size={18} />
                先试试云端版
                <ExternalLink size={14} />
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted">
            <div className="flex items-center gap-2"><Check size={16} className="text-forest" /> 完全免费使用</div>
            <div className="flex items-center gap-2"><Check size={16} className="text-forest" /> MiniMax Music 3.0</div>
            <div className="flex items-center gap-2"><Check size={16} className="text-forest" /> 本地数据保存</div>
            <div className="flex items-center gap-2"><Check size={16} className="text-forest" /> 持续更新升级</div>
          </div>
        </div>
      </section>

      {/* 下载卡片 */}
      <section id="downloads" className="px-10 py-12 border-t border-line">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl font-semibold">选择你的安装包</h2>
            <p className="mt-1 text-sm text-muted">不知道选哪个？Windows 选第一个，Mac M 系列选第三个。</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon
            const available = !loadingFiles && availableNames.has(pkg.filename)
            const disabled = loadingFiles || !available
            return (
              <div
                key={pkg.os}
                className={cn(
                  'relative rounded-3xl p-6 border transition-all group',
                  disabled && 'opacity-70',
                  !disabled && 'hover:shadow-lift',
                  pkg.recommended && !disabled
                    ? 'bg-gradient-to-br from-coral/5 to-transparent border-coral/20'
                    : 'bg-paper border-line',
                  !disabled && 'hover:border-ink/20',
                )}
              >
                {pkg.tag && !disabled && (
                  <div className="absolute top-5 right-5 px-2.5 py-1 rounded-full bg-coral text-white text-[10px] font-semibold tracking-wide">
                    {pkg.tag}
                  </div>
                )}
                {!available && !loadingFiles && (
                  <div className="absolute top-5 right-5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/20 text-muted text-[10px] font-semibold tracking-wide">
                    <AlertTriangle size={10} /> 暂未开放
                  </div>
                )}
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all',
                  disabled ? 'bg-cream text-muted' :
                  pkg.recommended ? 'bg-coral text-white' : 'bg-cream text-ink group-hover:bg-ink group-hover:text-paper',
                )}>
                  {loadingFiles ? <Loader2 size={22} className="animate-spin" /> : <Icon size={26} />}
                </div>
                <h3 className={cn('text-lg font-semibold', disabled ? 'text-ink/70' : 'text-ink')}>{pkg.name}</h3>
                <p className={cn('mt-1.5 text-sm leading-relaxed', disabled ? 'text-muted' : 'text-muted')}>
                  {pkg.desc}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                  <span>{available ? `文件大小：${formatSize(sizeOf(pkg.filename))}` : '正在重新打包上传中…'}</span>
                  {available && (
                    <a
                      className="underline-offset-2 hover:underline"
                      href={`/dl/${pkg.filename}.md5`}
                      download={`${pkg.filename}.md5`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      MD5
                    </a>
                  )}
                </div>
                <div className="mt-4">
                  <Button
                    variant={pkg.recommended && !disabled ? 'primary' : disabled ? 'outline' : 'dark'}
                    disabled={disabled}
                    block
                    onClick={() => handleDownload(pkg)}
                  >
                    {disabled ? (
                      <>
                        <AlertTriangle size={16} />
                        暂无法下载
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        下载 {pkg.filename}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 云端版卡片 */}
        <div className="mt-6 rounded-3xl p-7 border border-line bg-gradient-to-r from-ocean/5 via-transparent to-coral/5">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-ocean/10 flex items-center justify-center text-ocean flex-shrink-0">
              <Cloud size={30} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-ink">不想安装？直接用云端版</h3>
              <p className="mt-1.5 text-sm text-muted">
                打开浏览器就能用，作品数据与本地版互通。部署在 Railway 云端，7x24 小时不关机。
              </p>
            </div>
            <a href="/" target="_blank" rel="noreferrer">
              <Button variant="dark" size="lg">
                进入云端版
                <ExternalLink size={16} />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* 使用步骤 */}
      <section className="px-10 py-12 border-t border-line bg-cream/30">
        <h2 className="font-display text-2xl font-semibold mb-2">使用步骤</h2>
        <p className="text-sm text-muted mb-8">从下载到创作，只需四步。</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, idx) => (
            <div key={s.num} className="relative rounded-3xl p-6 bg-paper border border-line">
              <div className="absolute top-5 right-5 w-9 h-9 rounded-full bg-coral/10 text-coral text-sm font-bold flex items-center justify-center">
                {s.num}
              </div>
              <h3 className="text-base font-semibold text-ink mb-1.5 pr-10">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{s.desc}</p>
              {idx < STEPS.length - 1 && (
                <ChevronRight
                  size={20}
                  className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-line z-10 bg-paper rounded-full"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-10 py-12 border-t border-line">
        <h2 className="font-display text-2xl font-semibold mb-2">常见问题</h2>
        <p className="text-sm text-muted mb-8">还有不明白的地方，先看看这里。</p>
        <div className="space-y-3 max-w-3xl">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-line bg-paper p-5 open:shadow-soft open:border-ink/15">
              <summary className="flex items-center justify-between cursor-pointer list-none pr-2">
                <span className="font-semibold text-ink">{f.q}</span>
                <ChevronRight size={18} className="text-muted transition-transform group-open:rotate-90 flex-shrink-0 ml-4" />
              </summary>
              <p className="mt-3 text-sm text-muted leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="mx-10 mb-10 mt-2 rounded-3xl p-10 bg-gradient-to-br from-ink to-forest text-paper relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-coral/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-ocean/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold">准备好开始你的第一首歌了吗？</h2>
            <p className="mt-2 text-paper/70 text-sm">
              下载安装包，3 分钟后就能写出属于你的 AI 原创音乐。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="#downloads">
              <Button variant="primary" size="lg">
                <Download size={18} />
                立即下载
              </Button>
            </a>
            <a href="/" target="_blank" rel="noreferrer">
              <Button variant="outline" size="lg" className="!bg-transparent !border-paper/30 !text-paper hover:!bg-paper/10">
                <Cloud size={18} />
                云端版直达
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
