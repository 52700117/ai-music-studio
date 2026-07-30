/**
 * 音频引擎：用 Web Audio API 生成一段可播放的旋律
 * - 根据 prompt 关键词识别情绪，映射到调式/BPM/音色
 * - 加入和弦、低音线、节奏变化、鼓点
 * - 可渲染为 WAV Blob 用于下载
 * 演示用途，作为 AI 生成的降级方案
 */

export interface AudioSeed {
  mode: 'original' | 'lyrics' | 'pure' | 'remix'
  voice?: 'male' | 'female'
  prompt?: string
  lyrics?: string
}

/**
 * 情绪风格映射
 */
type Mood = 'happy' | 'sad' | 'calm' | 'intense' | 'dreamy' | 'dark'

interface MoodStyle {
  bpm: [number, number]   // BPM 范围
  scale: number[]         // 音阶
  chords: number[]        // 和弦进行根音
  melodyWave: OscillatorType
  bassWave: OscillatorType
  drum: 'none' | 'soft' | 'rock'
  reverb: number          // 混响强度 0-1
}

const MOOD_STYLES: Record<Mood, MoodStyle> = {
  happy: {
    bpm: [110, 130],
    scale: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25], // C 大调五声
    chords: [130.81, 174.61, 196.0, 146.83],
    melodyWave: 'triangle',
    bassWave: 'sine',
    drum: 'soft',
    reverb: 0.1,
  },
  sad: {
    bpm: [60, 75],
    scale: [220.0, 246.94, 277.18, 329.63, 369.99, 440.0, 493.88, 554.37], // A 小调五声
    chords: [146.83, 196.0, 174.61, 130.81],
    melodyWave: 'sine',
    bassWave: 'sine',
    drum: 'none',
    reverb: 0.3,
  },
  calm: {
    bpm: [70, 85],
    scale: [174.61, 196.0, 220.0, 233.08, 261.63, 293.66, 329.63, 349.23], // F 多利亚
    chords: [174.61, 196.0, 261.63, 146.83],
    melodyWave: 'sine',
    bassWave: 'sine',
    drum: 'soft',
    reverb: 0.25,
  },
  intense: {
    bpm: [140, 160],
    scale: [261.63, 311.13, 349.23, 392.0, 466.16, 523.25, 622.25, 698.46], // 蓝调
    chords: [196.0, 261.63, 174.61, 220.0],
    melodyWave: 'sawtooth',
    bassWave: 'sawtooth',
    drum: 'rock',
    reverb: 0.05,
  },
  dreamy: {
    bpm: [65, 80],
    scale: [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25], // G 混合利底亚
    chords: [196.0, 261.63, 174.61, 220.0],
    melodyWave: 'triangle',
    bassWave: 'sine',
    drum: 'none',
    reverb: 0.5,
  },
  dark: {
    bpm: [80, 95],
    scale: [220.0, 246.94, 277.18, 311.13, 369.99, 415.30, 466.16, 554.37], // 半音阶暗调
    chords: [110.0, 146.83, 130.81, 174.61],
    melodyWave: 'sawtooth',
    bassWave: 'sine',
    drum: 'soft',
    reverb: 0.35,
  },
}

// 中英文关键词 → 情绪映射
const MOOD_KEYWORDS: Record<Mood, string[]> = {
  happy: ['欢快', '快乐', '开心', '高兴', '阳光', 'happy', 'joy', 'cheerful', 'bright', 'upbeat', '夏日', '夏天', 'summer'],
  sad: ['悲伤', '难过', '伤心', 'sad', 'melancholy', '悲伤', '深夜', '夜', '孤独', 'lonely', 'tears'],
  calm: ['宁静', '平静', '安详', '清晨', '早晨', 'calm', 'peaceful', 'serene', 'morning', 'soft', 'gentle'],
  intense: ['激烈', '兴奋', '摇滚', '激烈', 'intense', 'rock', 'energetic', 'powerful', '快', 'fast'],
  dreamy: ['梦境', '梦', '幻想', '梦幻', 'dreamy', 'dream', 'ethereal', '仙', 'cloud'],
  dark: ['黑暗', '恐怖', '阴森', 'dark', 'horror', 'scary', '暗黑', '哥特', 'gothic'],
}

function detectMood(prompt: string): Mood {
  const p = (prompt || '').toLowerCase()
  let best: { mood: Mood; score: number } = { mood: 'calm', score: 0 }
  for (const [mood, kws] of Object.entries(MOOD_KEYWORDS) as [Mood, string[]][]) {
    let score = 0
    for (const kw of kws) {
      if (p.includes(kw.toLowerCase())) score++
    }
    if (score > best.score) best = { mood, score }
  }
  return best.mood
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface Note {
  freq: number
  start: number
  dur: number
  velocity: number
  type: 'melody' | 'bass' | 'chord' | 'kick' | 'snare' | 'hat'
}

/**
 * 根据情绪生成音符序列
 */
function buildNotes(seed: AudioSeed, titleSeed: string): { notes: Note[]; totalDur: number; style: MoodStyle } {
  const mood = detectMood(seed.prompt || '')
  const style = MOOD_STYLES[mood]

  // 用 prompt + titleSeed 一起做 hash，确保每次输入不同
  const seedStr = (seed.prompt || '') + '|' + titleSeed + '|' + seed.mode + '|' + (seed.voice || '')
  const h = hashStr(seedStr)

  const scale = style.scale
  const chords = style.chords
  const bpm = style.bpm[0] + (h % (style.bpm[1] - style.bpm[0]))
  const beatDur = 60 / bpm
  const noteDur = beatDur * 0.5
  const bars = 16
  const beatsPerBar = 4
  const totalDur = bars * beatsPerBar * beatDur

  const notes: Note[] = []
  let t = 0

  for (let bar = 0; bar < bars; bar++) {
    const chordIdx = Math.floor(bar / 2) % chords.length
    const chordRoot = chords[chordIdx]
    const chordThird = chordRoot * 1.25
    const chordFifth = chordRoot * 1.5

    // 和弦铺底
    notes.push({ freq: chordRoot, start: t, dur: beatDur * 4, velocity: 0.12, type: 'chord' })
    notes.push({ freq: chordThird, start: t, dur: beatDur * 4, velocity: 0.1, type: 'chord' })
    notes.push({ freq: chordFifth, start: t, dur: beatDur * 4, velocity: 0.1, type: 'chord' })

    // 低音线
    notes.push({ freq: chordRoot * 0.5, start: t, dur: beatDur * 1.5, velocity: 0.22, type: 'bass' })
    notes.push({ freq: chordRoot * 0.5, start: t + beatDur * 2, dur: beatDur * 1.5, velocity: 0.2, type: 'bass' })

    // 鼓点
    if (style.drum === 'soft' || style.drum === 'rock') {
      // Kick - 每拍一次
      for (let b = 0; b < beatsPerBar; b++) {
        notes.push({ freq: 60, start: t + b * beatDur, dur: 0.15, velocity: style.drum === 'rock' ? 0.5 : 0.3, type: 'kick' })
      }
      // Snare - 2、4拍
      if (style.drum === 'rock') {
        notes.push({ freq: 200, start: t + beatDur, dur: 0.1, velocity: 0.4, type: 'snare' })
        notes.push({ freq: 200, start: t + beatDur * 3, dur: 0.1, velocity: 0.4, type: 'snare' })
      }
      // Hi-hat - 八分音符
      for (let b = 0; b < beatsPerBar * 2; b++) {
        notes.push({ freq: 8000, start: t + b * noteDur, dur: 0.05, velocity: 0.08, type: 'hat' })
      }
    }

    // 旋律线
    for (let beat = 0; beat < beatsPerBar * 2; beat++) {
      const noteIdx = (h >> ((bar * 8 + beat) % 28)) % scale.length
      const freq = scale[noteIdx]
      const isRest = (h >> (bar + beat * 3)) & 1 && beat === 2 && bar % 3 === 0
      if (!isRest) {
        const dur = beat % 3 === 2 ? noteDur * 1.5 : noteDur
        const velocity = 0.28 + ((h >> beat) & 1) * 0.1
        notes.push({ freq, start: t, dur, velocity, type: 'melody' })
      }
      t += noteDur
    }
    t = (bar + 1) * beatsPerBar * beatDur
  }

  return { notes, totalDur, style }
}

/**
 * 用 Web Speech API 朗读歌词，模拟"演唱"
 * 男声/女声通过选择对应 voice 实现
 */
function speakLyrics(lyrics: string, voice: 'male' | 'female' | undefined, durationSec: number): () => void {
  if (!('speechSynthesis' in window)) return () => {}
  const synth = window.speechSynthesis
  const utter = new SpeechSynthesisUtterance(lyrics)
  utter.lang = 'zh-CN'
  utter.rate = 0.85
  utter.pitch = voice === 'male' ? 0.7 : 1.3
  utter.volume = 0.9

  // 尝试匹配男声/女声
  const pickVoice = () => {
    const voices = synth.getVoices()
    if (!voices.length) return
    const zh = voices.filter((v) => v.lang?.toLowerCase().startsWith('zh'))
    const pool = zh.length ? zh : voices
    let picked
    if (voice === 'male') {
      picked = pool.find((v) => /male|男|hui|ting|yun/i.test(v.name)) || pool[0]
    } else {
      picked = pool.find((v) => /female|女|xiao|mei|ting/i.test(v.name)) || pool[0]
    }
    if (picked) utter.voice = picked
  }
  pickVoice()
  // voices 可能异步加载
  if (!synth.getVoices().length) {
    synth.onvoiceschanged = () => { pickVoice(); synth.onvoiceschanged = null }
  }

  // 延迟一点开始，让背景音乐先进入
  const startTimer = window.setTimeout(() => {
    try { synth.speak(utter) } catch { /* noop */ }
  }, 600)

  return () => {
    window.clearTimeout(startTimer)
    try { synth.cancel() } catch { /* noop */ }
  }
}

/**
 * 在线播放一段生成的旋律
 */
export function playGenerated(seed: AudioSeed, titleSeed: string, durationSec = 30): () => void {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  const ctx = new Ctx()
  const { notes, totalDur, style } = buildNotes(seed, titleSeed)
  const actualDur = Math.min(durationSec, totalDur)

  const master = ctx.createGain()
  master.gain.value = 0.22
  master.connect(ctx.destination)

  // 混响：根据风格调整强度
  const delay = ctx.createDelay()
  delay.delayTime.value = 0.28
  const fb = ctx.createGain()
  fb.gain.value = 0.05 + style.reverb * 0.3
  delay.connect(fb)
  fb.connect(delay)
  delay.connect(master)

  const sources: AudioScheduledSourceNode[] = []

  notes.forEach((n) => {
    if (n.start > actualDur) return
    const start = ctx.currentTime + n.start
    const dur = Math.min(n.dur, actualDur - n.start)
    if (dur <= 0) return

    // 鼓点用噪声合成，不用 oscillator
    if (n.type === 'kick') {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(n.freq * 2, start)
      osc.frequency.exponentialRampToValueAtTime(n.freq * 0.5, start + 0.1)
      const g = ctx.createGain()
      g.gain.setValueAtTime(n.velocity, start)
      g.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.connect(g)
      g.connect(master)
      osc.start(start)
      osc.stop(start + dur + 0.05)
      sources.push(osc)
      return
    }
    if (n.type === 'snare' || n.type === 'hat') {
      // 白噪声
      const bufSize = Math.floor(ctx.sampleRate * dur)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      // hat 用高通，snare 用带通
      const filter = ctx.createBiquadFilter()
      filter.type = n.type === 'hat' ? 'highpass' : 'bandpass'
      filter.frequency.value = n.type === 'hat' ? 7000 : 1800
      const g = ctx.createGain()
      g.gain.setValueAtTime(n.velocity, start)
      g.gain.exponentialRampToValueAtTime(0.001, start + dur)
      src.connect(filter)
      filter.connect(g)
      g.connect(master)
      src.start(start)
      src.stop(start + dur + 0.02)
      sources.push(src)
      return
    }

    // 普通音符
    const osc = ctx.createOscillator()
    if (n.type === 'melody') {
      osc.type = style.melodyWave
    } else if (n.type === 'bass') {
      osc.type = style.bassWave
    } else {
      osc.type = 'triangle'
    }
    osc.frequency.value = n.freq

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(n.velocity, start + 0.02)
    g.gain.setValueAtTime(n.velocity, start + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.001, start + dur)

    osc.connect(g)
    if (n.type === 'melody') {
      g.connect(master)
      g.connect(delay)
    } else {
      g.connect(master)
    }
    osc.start(start)
    osc.stop(start + dur + 0.05)
    sources.push(osc)
  })

  const endAt = ctx.currentTime + actualDur + 0.5

  // 如有歌词，启动人声朗读（男声/女声）
  const stopVocal = seed.lyrics ? speakLyrics(seed.lyrics, seed.voice, actualDur) : () => {}

  return () => {
    stopVocal()
    sources.forEach((s) => {
      try { s.stop() } catch { /* already stopped */ }
    })
    try {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
    } catch { /* noop */ }
    setTimeout(() => ctx.close().catch(() => {}), 300)
  }
}

/**
 * 渲染为 WAV Blob（用于下载）
 */
export function renderWavBlob(seed: AudioSeed, titleSeed: string, durationSec = 30): Blob {
  const sampleRate = 22050
  const { notes, totalDur, style } = buildNotes(seed, titleSeed)
  const actualDur = Math.min(durationSec, totalDur)
  const total = Math.floor(sampleRate * actualDur)
  const buffer = new Float32Array(total)

  notes.forEach((n) => {
    if (n.start > actualDur) return
    const startIdx = Math.floor(n.start * sampleRate)
    const dur = Math.min(n.dur, actualDur - n.start)
    const len = Math.floor(dur * sampleRate)
    if (len <= 0) return

    // 鼓点：噪声或低频脉冲
    if (n.type === 'kick') {
      for (let i = 0; i < len && startIdx + i < total; i++) {
        const tt = i / sampleRate
        const freq = n.freq * 2 * Math.exp(-tt * 20) + n.freq * 0.5
        const env = Math.exp(-i / (len * 0.3))
        buffer[startIdx + i] += Math.sin(2 * Math.PI * freq * tt) * n.velocity * env
      }
      return
    }
    if (n.type === 'snare' || n.type === 'hat') {
      for (let i = 0; i < len && startIdx + i < total; i++) {
        const env = Math.exp(-i / (len * 0.4))
        const noise = Math.random() * 2 - 1
        // hat 只取高频
        const filtered = n.type === 'hat' ? noise * 0.5 : noise
        buffer[startIdx + i] += filtered * n.velocity * env
      }
      return
    }

    // 不同声部用不同波形
    let waveform: OscillatorType
    if (n.type === 'melody') {
      waveform = style.melodyWave
    } else if (n.type === 'bass') {
      waveform = style.bassWave
    } else {
      waveform = 'triangle'
    }

    for (let i = 0; i < len && startIdx + i < total; i++) {
      const env = Math.min(1, i / 64) * Math.exp(-i / (len * 0.7))
      const tt = i / sampleRate
      let v: number
      if (waveform === 'sine') v = Math.sin(2 * Math.PI * n.freq * tt)
      else if (waveform === 'sawtooth') v = 2 * ((n.freq * tt) % 1) - 1
      else if (waveform === 'triangle') v = 2 * Math.abs(2 * ((n.freq * tt) % 1) - 1) - 1
      else v = 0 // custom, 不支持
      buffer[startIdx + i] += v * n.velocity * env
    }
  })

  // 归一化
  let peak = 0
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(buffer[i]))
  const norm = peak > 0 ? 0.85 / peak : 1
  const data = new Int16Array(total)
  for (let i = 0; i < total; i++) {
    let s = buffer[i] * norm
    s = Math.max(-1, Math.min(1, s))
    data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const buf = new ArrayBuffer(44 + data.length * 2)
  const view = new DataView(buf)
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + data.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, data.length * 2, true)
  for (let i = 0; i < data.length; i++) view.setInt16(44 + i * 2, data[i], true)

  return new Blob([buf], { type: 'audio/wav' })
}

/**
 * 下载 blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
