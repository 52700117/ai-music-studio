/**
 * 完成弹窗：播放 / 下载 / 转发微信，并询问是否放到广场
 */
import { useState, useRef } from 'react'
import { Play, Pause, Download, Share2, Check, Music, SquareStack } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Waveform } from '@/components/ui/ProgressBar'
import { playGenerated, renderWavBlob, downloadBlob, type AudioSeed } from '@/lib/audio'
import { api } from '@/lib/api'

interface Props {
  open: boolean
  title: string
  seed: AudioSeed
  creationId: number
  audioUrl?: string | null
  onClose: () => void
  onShared: () => void
}

export default function CompletionModal({ open, title, seed, creationId, audioUrl, onClose, onShared }: Props) {
  const [playing, setPlaying] = useState(false)
  const [stage, setStage] = useState<'done' | 'askShare' | 'shared'>('done')
  const stopRef = useRef<(() => void) | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [sharing, setSharing] = useState(false)

  const togglePlay = () => {
    if (playing) {
      stopRef.current?.()
      stopRef.current = null
      audioRef.current?.pause()
      setPlaying(false)
    } else {
      if (audioUrl) {
        // 真实 AI 音频：用 <audio> 元素播放
        if (!audioRef.current) {
          audioRef.current = new Audio(audioUrl)
          audioRef.current.onended = () => setPlaying(false)
        }
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => alert('音频加载失败'))
        setPlaying(true)
      } else {
        // 降级：振荡器 + TTS
        const dur = seed.durationSec || 30
        stopRef.current = playGenerated(seed, title)
        setPlaying(true)
        setTimeout(() => {
          stopRef.current?.()
          stopRef.current = null
          setPlaying(false)
        }, dur * 1000)
      }
    }
  }

  const handleDownload = () => {
    if (audioUrl) {
      // 真实音频：直接下载
      const a = document.createElement('a')
      a.href = audioUrl
      a.download = `${title || '作品'}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else {
      // 降级：振荡器渲染
      const blob = renderWavBlob(seed, title)
      downloadBlob(blob, `${title || '作品'}.wav`)
    }
  }

  const handleWeChat = () => {
    // 演示：调用微信网页分享或复制链接
    const text = `我用音乐制作工具创作了《${title}》，快来听听！`
    if (navigator.share) {
      navigator.share({ title: '音乐制作工具作品', text }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text).then(
        () => alert('已复制分享文案，粘贴到微信即可转发'),
        () => alert('请手动复制：' + text),
      )
    }
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      await api.shareCreation(creationId)
      setStage('shared')
      onShared()
    } catch (e: any) {
      alert(e.message || '分享失败')
    } finally {
      setSharing(false)
    }
  }

  const close = () => {
    stopRef.current?.()
    stopRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    setPlaying(false)
    setStage('done')
    onClose()
  }

  return (
    <Modal open={open} onClose={close} size="md" hideClose={stage !== 'shared'}>
      {stage === 'done' && (
        <div className="p-8 text-center">
          <div className="relative mx-auto mb-6 w-20 h-20">
            <span className="absolute inset-0 rounded-full bg-coral/20 animate-pulse-ring" />
            <div className="relative w-20 h-20 rounded-full bg-coral flex items-center justify-center shadow-coral">
              <Music className="text-white" size={32} />
            </div>
          </div>
          <div className="text-coral text-xs font-semibold tracking-widest uppercase">制作完成</div>
          <h2 className="mt-2 font-display text-3xl font-semibold">音乐制作完成了！</h2>
          <p className="mt-2 text-muted text-sm">
            作品名：<span className="text-ink font-medium">{title}</span>
          </p>

          <div className="my-6 flex items-center justify-center">
            <Waveform active={playing} bars={32} />
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <Button variant="outline" size="md" onClick={togglePlay}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? '暂停' : '试听'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="md" onClick={handleDownload}>
              <Download size={16} /> 下载
            </Button>
            <Button variant="wechat" size="md" onClick={handleWeChat}>
              <Share2 size={16} /> 转发微信
            </Button>
          </div>

          <div className="mt-6 flex flex-col gap-3 items-stretch">
            <button
              onClick={() => setStage('askShare')}
              className="w-full py-3 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral/90 transition-colors"
            >
              下一步：是否放到广场？ →
            </button>
            <button
              onClick={close}
              className="w-full py-3 rounded-full border border-line text-sm font-medium text-muted hover:text-ink hover:border-ink/30 transition-colors"
            >
              稍后再说
            </button>
          </div>
        </div>
      )}

      {stage === 'askShare' && (
        <div className="p-8 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-coral-50 flex items-center justify-center">
            <SquareStack className="text-coral" size={28} />
          </div>
          <h2 className="font-display text-2xl font-semibold">是否放到歌曲广场？</h2>
          <p className="mt-3 text-muted text-sm leading-relaxed">
            放到广场后，其他用户可以听到你的作品，并基于它改编出新的版本。
            <br />
            你也可以选择不放，仅自己保存。
          </p>
          <div className="mt-7 flex gap-3">
            <Button variant="outline" size="md" block onClick={close}>
              不放
            </Button>
            <Button variant="primary" size="md" block loading={sharing} onClick={handleShare}>
              放到广场
            </Button>
          </div>
        </div>
      )}

      {stage === 'shared' && (
        <div className="p-8 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-[#28c840] flex items-center justify-center">
            <Check className="text-white" size={28} />
          </div>
          <h2 className="font-display text-2xl font-semibold">已发布到广场</h2>
          <p className="mt-3 text-muted text-sm">
            你的作品《{title}》已上架，其他人现在可以听到并改编它了。
          </p>
          <div className="mt-6">
            <Button variant="primary" size="md" block onClick={close}>
              完成
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
