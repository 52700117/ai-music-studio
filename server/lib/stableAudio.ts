/**
 * ACE Data Cloud - Suno API 封装
 * - 提交音乐生成任务（支持灵感模式、自定义歌词、纯音乐）
 * - 轮询任务状态直到完成
 * - 下载音频文件到本地
 *
 * 平台：https://platform.acedata.cloud
 * 文档：Suno Audios API
 * 鉴权：Bearer Token（在平台 Acquire 获取）
 * Base URL：https://api.acedata.cloud
 *
 * 音乐生成是异步任务：
 * 1. POST /suno/audios 提交 → 返回 task_id
 * 2. POST /suno/tasks 轮询 → state=succeeded 后拿音频 URL
 */

const ACEDATA_BASE = 'https://api.acedata.cloud'

function getApiToken(): string | null {
  return process.env.ACEDATA_API_TOKEN || process.env.STABLE_AUDIO_API_KEY || null
}

export function isStableAudioEnabled(): boolean {
  return !!getApiToken()
}

interface SunoSubmitResponse {
  task_id?: string
  // 兼容 wait:true 同步返回
  data?: Array<{
    audio_url?: string
    title?: string
    id?: string
  }>
}

interface SunoTaskResponse {
  state?: 'pending' | 'running' | 'succeeded' | 'failed'
  data?: Array<{
    audio_url?: string
    title?: string
    id?: string
  }>
  error?: string
}

/**
 * 提交音乐生成任务
 */
async function submitTask(opts: {
  prompt?: string
  lyrics?: string
  title?: string
  style?: string
  instrumental?: boolean
}): Promise<string> {
  const token = getApiToken()
  if (!token) throw new Error('ACEDATA_API_TOKEN 未配置')

  const body: Record<string, any> = {
    model: 'chirp-v3-5',
  }

  if (opts.lyrics && opts.lyrics.trim()) {
    // 自定义模式：带歌词演唱
    body.mv = 'custom'
    body.title = opts.title || '无题'
    body.lyrics = opts.lyrics
    body.style = opts.style || 'pop, mandarin'
  } else if (opts.instrumental) {
    // 纯音乐
    body.mv = 'custom'
    body.prompt = opts.prompt || 'instrumental music'
    body.make_instrumental = true
  } else {
    // 灵感模式：AI 自动作曲作词
    body.mv = 'inspiration'
    body.prompt = opts.prompt || 'a beautiful song'
    body.make_instrumental = false
  }

  const res = await fetch(`${ACEDATA_BASE}/suno/audios`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Suno 提交失败 (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as SunoSubmitResponse
  if (!data.task_id) {
    throw new Error(`Suno 未返回 task_id: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data.task_id
}

/**
 * 轮询任务状态直到完成或超时
 */
async function pollTask(taskId: string, timeoutMs = 120000): Promise<string> {
  const token = getApiToken()
  if (!token) throw new Error('ACEDATA_API_TOKEN 未配置')

  const start = Date.now()
  const interval = 5000

  while (Date.now() - start < timeoutMs) {
    await sleep(interval)
    const res = await fetch(`${ACEDATA_BASE}/suno/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task_id: taskId }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Suno 轮询失败 (${res.status}): ${errText.slice(0, 200)}`)
    }

    const data = (await res.json()) as SunoTaskResponse
    if (data.state === 'succeeded') {
      const audioUrl = data.data?.[0]?.audio_url
      if (!audioUrl) throw new Error('Suno 任务完成但无音频 URL')
      return audioUrl
    }
    if (data.state === 'failed') {
      throw new Error(`Suno 任务失败: ${data.error || '未知错误'}`)
    }
    // pending / running 继续轮询
  }

  throw new Error('Suno 任务超时未完成')
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface StableAudioResult {
  audioUrl: string // Suno 返回的音频 URL
  finishReason: string
}

/**
 * 生成音乐：提交任务 → 轮询完成 → 返回音频 URL
 * 调用方负责下载 URL 并存到本地
 */
export async function generateAudio(opts: {
  prompt: string
  lyrics?: string
  title?: string
  durationSec?: number
  seed?: number
}): Promise<StableAudioResult> {
  const isInstrumental = !opts.lyrics || !opts.lyrics.trim()

  const taskId = await submitTask({
    prompt: opts.prompt,
    lyrics: opts.lyrics,
    title: opts.title,
    instrumental: isInstrumental && opts.prompt.toLowerCase().includes('instrumental') ? true : !opts.lyrics,
  })

  const audioUrl = await pollTask(taskId)

  return {
    audioUrl,
    finishReason: 'succeeded',
  }
}

/**
 * 下载远程音频 URL 到 Buffer
 */
export async function downloadAudioToBuffer(audioUrl: string): Promise<Buffer> {
  const res = await fetch(audioUrl)
  if (!res.ok) throw new Error(`下载音频失败 (${res.status})`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
