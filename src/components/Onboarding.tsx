/**
 * 新手引导流程
 * 1) "你会使用吗?" → 会 / 不会
 * 2) 不会 → 详细文字教程 → "会了吗?" → 会了 / 我还是不会
 * 3) 我还是不会 → 视频教程弹窗（动画演示）
 */
import { useEffect, useState } from 'react'
import { Check, X, Sparkles, FileMusic, Play, CircleHelp, ListChecks, Download, Share2, Hand, ArrowRight, AlignLeft } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { Waveform } from './ui/ProgressBar'
import { useStore } from '@/store/useStore'

type Stage = 'ask' | 'tutorial' | 'video'

const TUTORIAL_STEPS = [
  {
    icon: ListChecks,
    title: '选择创作模式',
    desc: '页面顶部有三个模式可选：「原创音乐」按你的文字要求生成全新歌曲；「改编音乐」把你写的歌词唱出来；「纯音乐」生成没有人声的伴奏。',
  },
  {
    icon: FileMusic,
    title: '填写你的要求',
    desc: '在大输入框里写下你想要的音乐。原创模式写风格与画面（如"夏夜海边轻快的尤克里里"）；改编音乐模式在下方正方形区域放入歌词。',
  },
  {
    icon: Hand,
    title: '选择人声（可选）',
    desc: '改编音乐模式下会出现「男声 / 女声」两个选项，点一下选中即可。纯音乐模式不需要选人声。',
  },
  {
    icon: AlignLeft,
    title: '放入歌词（改编音乐模式）',
    desc: '下方正方形区域是歌词输入区，切换到「改编音乐」模式后，把你的歌词粘贴或输入进去，AI 会把它唱成歌。',
  },
  {
    icon: Sparkles,
    title: '点击「开始制作」',
    desc: '点珊瑚红色的制作按钮，会出现进度条，约几秒后弹窗提示「音乐制作完成」。',
  },
  {
    icon: Play,
    title: '试听你的作品',
    desc: '完成弹窗里可以点播放试听，满意就点「下载」保存，或点「转发到微信」分享给朋友。',
  },
  {
    icon: Share2,
    title: '发布到歌曲广场',
    desc: '完成后会问是否放到广场，点「放」就能让其他用户听到并基于你的歌二次创作。点「不放」则只自己保存。',
  },
  {
    icon: CircleHelp,
    title: '左侧三个页签',
    desc: '最左「编辑」是创作页；中间「广场」浏览他人作品并改编；最右「我的」登录、查看历史创作、提交建议。',
  },
  {
    icon: Download,
    title: '随时再来一首',
    desc: '完成后回到输入框就能继续创作下一首，所有作品都会记录在「我的创作」里。',
  },
]

export default function Onboarding() {
  const { showOnboarding, finishOnboarding } = useStore()
  const [stage, setStage] = useState<Stage>('ask')

  useEffect(() => {
    if (showOnboarding) setStage('ask')
  }, [showOnboarding])

  const close = () => finishOnboarding()

  if (!showOnboarding) return null

  return (
    <>
      {/* 第一阶段：会不会使用 */}
      <Modal open={stage === 'ask'} size="md" hideClose>
        <div className="p-10 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-coral-50 flex items-center justify-center">
            <CircleHelp className="text-coral" size={30} />
          </div>
          <h2 className="font-display text-3xl font-semibold text-ink">你会使用音乐制作工具吗？</h2>
          <p className="mt-3 text-muted leading-relaxed">
            第一次见面，先确认一下。我们会根据你的情况，带你快速上手。
          </p>
          <div className="mt-8 flex gap-3">
            <Button variant="outline" size="lg" block onClick={() => setStage('tutorial')}>
              <X size={18} /> 不会
            </Button>
            <Button variant="primary" size="lg" block onClick={close}>
              <Check size={18} /> 会
            </Button>
          </div>
        </div>
      </Modal>

      {/* 第二阶段：详细文字教程 */}
      <Modal open={stage === 'tutorial'} size="lg" hideClose>
        <div className="flex flex-col">
          <div className="px-8 pt-8 pb-4 border-b border-line">
            <div className="flex items-center gap-2 text-coral text-xs font-semibold tracking-widest uppercase">
              <Sparkles size={14} /> 新手教程
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">9 步学会创作一首歌</h2>
            <p className="mt-2 text-muted text-sm">每一步都很简单，跟着看一遍就能上手。</p>
          </div>
          <div className="px-8 py-6 overflow-y-auto fade-bottom" style={{ maxHeight: '52vh' }}>
            <ol className="space-y-5">
              {TUTORIAL_STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <li key={i} className="flex gap-4">
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-xl bg-cream border border-line flex items-center justify-center">
                        <Icon size={18} className="text-coral" />
                      </div>
                      {i < TUTORIAL_STEPS.length - 1 && (
                        <div className="w-px flex-1 bg-line my-1" style={{ minHeight: 16 }} />
                      )}
                    </div>
                    <div className="pb-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-coral font-semibold">{i + 1}.</span>
                        <h3 className="font-semibold text-ink">{s.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted leading-relaxed">{s.desc}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
          <div className="px-8 py-5 border-t border-line bg-cream/50">
            <div className="mb-3 text-center text-sm text-ink font-medium">看完教程，会了吗？</div>
            <div className="flex gap-3">
              <Button variant="outline" size="md" block onClick={() => setStage('video')}>
                <X size={16} /> 还是不会
              </Button>
              <Button variant="primary" size="md" block onClick={close}>
                <Check size={16} /> 会了
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 第三阶段：视频教程 */}
      <Modal open={stage === 'video'} size="lg" hideClose>
        <div className="flex flex-col">
          <div className="px-8 pt-8 pb-4 border-b border-line">
            <div className="flex items-center gap-2 text-coral text-xs font-semibold tracking-widest uppercase">
              <Play size={14} /> 视频教程
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">更详细的流程演示</h2>
            <p className="mt-2 text-muted text-sm">下面这段演示会一步步带你走完整个创作流程。</p>
          </div>

          <div className="px-8 py-6">
            <VideoDemo />
          </div>

          <div className="px-8 py-5 border-t border-line bg-cream/50">
            <Button variant="primary" size="md" block onClick={close}>
              <Check size={16} /> 我看明白了，开始创作
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

/**
 * 视频教程：用动画演示创作流程（无需外部视频文件）
 */
const DEMO_STEPS = [
  { t: '① 选择「原创音乐」模式', sub: '在顶部模式栏点击' },
  { t: '② 输入框写下你的要求', sub: '例如：清晨咖啡馆的轻爵士' },
  { t: '③ 点击「开始制作」', sub: '珊瑚红按钮' },
  { t: '④ 进度条走满 → 弹窗提示完成', sub: '约几秒钟' },
  { t: '⑤ 试听 → 下载 / 转发微信', sub: '或发布到歌曲广场' },
]

function VideoDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % (DEMO_STEPS.length + 1))
    }, 1800)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rounded-2xl overflow-hidden border border-line shadow-soft bg-ink">
      {/* 顶部播放器条 */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-black/30">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11px] text-white/40 font-mono-code">音乐制作工具 · 创作流程演示.mp4</span>
      </div>
      {/* 画面 */}
      <div className="relative aspect-video bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center overflow-hidden">
        {/* 背景波形 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <Waveform bars={40} active />
        </div>
        {/* 进度点 */}
        <div className="absolute top-4 left-4 right-4 flex gap-1.5">
          {DEMO_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i < step ? 'bg-coral' : 'bg-white/15'
              }`}
            />
          ))}
        </div>
        {/* 当前步骤 */}
        <div className="relative text-center px-6">
          {step < DEMO_STEPS.length ? (
            <div key={step} className="animate-pop-in">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-coral mb-4 shadow-coral">
                <ArrowRight className="text-white" size={24} />
              </div>
              <div className="font-display text-2xl text-white font-semibold">{DEMO_STEPS[step].t}</div>
              <div className="mt-1 text-white/50 text-sm">{DEMO_STEPS[step].sub}</div>
            </div>
          ) : (
            <div className="animate-pop-in">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#28c840] mb-4">
                <Check className="text-white" size={24} />
              </div>
              <div className="font-display text-2xl text-white font-semibold">完成！可以开始你的创作</div>
            </div>
          )}
        </div>
      </div>
      {/* 底部进度条 */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-coral transition-all duration-300"
          style={{ width: `${(step / DEMO_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  )
}
