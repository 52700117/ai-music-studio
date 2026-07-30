/**
 * 歌曲广场：卡片网格 / 试听 / 改编
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, Shuffle, Headphones, RefreshCw, Music2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Waveform } from '@/components/ui/ProgressBar'
import { api, type PlazaSong, type AudioSeed } from '@/lib'
import { playGenerated } from '@/lib/audio'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function Plaza() {
  const nav = useNavigate()
  const { plaza, loadPlaza, setRemixSource, user } = useStore()
  const [playingId, setPlayingId] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const [remixing, setRemixing] = useState<number | null>(null)

  useEffect(() => {
    loadPlaza()
  }, [loadPlaza])

  const togglePlay = async (song: PlazaSong) => {
    if (playingId === song.id) {
      stopRef.current?.()
      stopRef.current = null
      setPlayingId(null)
      return
    }
    stopRef.current?.()
    const seed: AudioSeed = { mode: 'original', voice: 'female' }
    stopRef.current = playGenerated(seed, song.title + song.author, 30)
    setPlayingId(song.id)
    try {
      await api.plazaPlay(song.id)
    } catch {
      /* noop */
    }
    setTimeout(() => {
      stopRef.current?.()
      stopRef.current = null
      setPlayingId((p) => (p === song.id ? null : p))
    }, 30000)
  }

  const remix = async (song: PlazaSong) => {
    if (!user) {
      nav('/profile')
      return
    }
    setRemixing(song.id)
    try {
      const r = await api.plazaRemix(song.id)
      setRemixSource({
        id: r.song.id,
        creationId: 0,
        title: r.song.title,
        author: r.song.author,
        coverColor: r.song.coverColor,
        playCount: 0,
        remixCount: 0,
        sharedAt: '',
      })
      nav('/')
    } catch (e: any) {
      alert(e.message || '改编失败')
    } finally {
      setRemixing(null)
    }
  }

  useEffect(() => () => { stopRef.current?.(); stopRef.current = null }, [])

  return (
    <div className="min-h-full">
      <header className="px-10 pt-10 pb-6 border-b border-line">
        <div className="flex items-center gap-2 text-coral text-xs font-semibold tracking-widest uppercase mb-2">
          <Headphones size={14} /> 歌曲广场
        </div>
        <h1 className="font-display text-4xl font-semibold leading-tight">
          听听别人写的歌，<br />
          <span className="text-coral">喜欢就改编成你的版本</span>
        </h1>
        <p className="mt-3 text-muted text-sm">广场里的每一首都可以试听，也可以基于它二次创作。</p>
      </header>

      <div className="px-10 py-8">
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-muted">共 {plaza.length} 首作品</div>
          <Button variant="ghost" size="sm" onClick={() => loadPlaza()}>
            <RefreshCw size={14} /> 刷新
          </Button>
        </div>

        {plaza.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <Music2 size={36} className="mx-auto mb-3 opacity-40" />
            广场还空着，去创作第一首吧
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-5">
            {plaza.map((song) => (
              <div
                key={song.id}
                className="group rounded-3xl border border-line bg-paper overflow-hidden hover:shadow-lift transition-all"
              >
                {/* 封面 */}
                <div
                  className="relative aspect-square flex items-end p-4"
                  style={{ background: `linear-gradient(135deg, ${song.coverColor}, ${song.coverColor}cc)` }}
                >
                  <div className="absolute inset-0 opacity-30 flex items-center justify-center">
                    <Waveform active={playingId === song.id} bars={18} />
                  </div>
                  <button
                    onClick={() => togglePlay(song)}
                    className="relative w-12 h-12 rounded-full bg-white text-ink flex items-center justify-center shadow-lift hover:scale-110 transition-transform"
                  >
                    {playingId === song.id ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>
                </div>
                {/* 信息 */}
                <div className="p-4">
                  <div className="font-display text-lg font-semibold truncate">{song.title}</div>
                  <div className="text-xs text-muted mt-0.5">{song.author}</div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><Play size={11} /> {song.playCount}</span>
                    <span className="flex items-center gap-1"><Shuffle size={11} /> {song.remixCount}</span>
                  </div>
                  <button
                    onClick={() => remix(song)}
                    disabled={remixing === song.id}
                    className={cn(
                      'mt-4 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-sm font-semibold transition-all',
                      'bg-ink text-paper hover:bg-black disabled:opacity-40',
                    )}
                  >
                    <Shuffle size={14} />
                    {remixing === song.id ? '载入中…' : '改编这首歌'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
