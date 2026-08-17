/**
 * MiniMax Music Generation API 接入
 * - music-3.0-free：免费版，RPM=3，模型质量与 music-3.0 相同
 * - 文档：https://platform.minimaxi.com/docs/api-reference/music-generation
 *
 * 环境变量：MINIMAX_API_KEY
 */

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const BASE = process.env.MINIMAX_BASE || 'https://api.minimaxi.com/v1'

export function isMiniMaxEnabled(): boolean {
  return !!MINIMAX_API_KEY
}

interface GenerateOptions {
  prompt: string
  lyrics?: string
  aiLyricsReq?: string
  voice?: 'male' | 'female'
  mode?: 'original' | 'lyrics' | 'pure' | 'remix'
  creationId: number
  durationSec?: number
}

interface MiniMaxResult {
  audioUrl: string
  taskId?: string
}

/**
 * 构造 music-3.0-free 请求体
 * - 纯音乐：is_instrumental=true，无需 lyrics
 * - AI 写词：lyrics_optimizer=true，AI 根据 prompt+要求 自动生成歌词
 * - 普通模式：直接使用用户提供的 lyrics
 */
function buildRequestBody(opts: GenerateOptions): any {
  const { prompt, lyrics, aiLyricsReq, voice, mode, durationSec } = opts

  const isInstrumental = mode === 'pure'
  const hasLyrics = !!lyrics?.trim()
  const hasAiReq = !!aiLyricsReq?.trim()

  let fullPrompt = prompt.slice(0, 2000)
  if (voice === 'male') fullPrompt += ', male vocal'
  else if (voice === 'female') fullPrompt += ', female vocal'

  if (isInstrumental) {
    fullPrompt += ', pure music, instrumental, no vocals'
  }

  if (hasAiReq) {
    fullPrompt += `. Lyrics theme: ${aiLyricsReq!.slice(0, 500)}`
  }

  const body: any = {
    model: 'music-3.0-free',
    prompt: fullPrompt,
    output_format: 'url',
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    },
    duration: Math.max(10, Math.min(300, durationSec || 60)),
  }

  if (isInstrumental) {
    body.is_instrumental = true
  } else if (hasLyrics) {
    body.lyrics = lyrics!.slice(0, 3500)
  } else {
    body.lyrics_optimizer = true
    body.lyrics = ''
  }

  return body
}

/**
 * 调用 MiniMax 音乐生成 API
 * 同步接口：HTTP 请求会保持到生成完成（约 30-90 秒）
 * 超时设为 180 秒，足够生成一首歌
 */
export async function generateMusicWithMiniMax(opts: GenerateOptions): Promise<MiniMaxResult> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY 未配置')
  }

  const url = `${BASE}/music_generation`
  const body = buildRequestBody(opts)

  console.log(`[minimax] creation #${opts.creationId} 开始生成, prompt="${opts.prompt.slice(0, 50)}..."`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180000) // 180 秒超时

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`MiniMax HTTP ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = await res.json() as any

    // 检查业务状态码
    const statusCode = data.base_resp?.status_code
    if (statusCode !== 0 && statusCode !== undefined) {
      const msg = data.base_resp?.status_msg || '未知错误'
      throw new Error(`MiniMax 业务错误 ${statusCode}: ${msg}`)
    }

    // 优先取 URL 格式的音频
    const audioUrl =
      data.data?.audio?.[0]?.audio_url ||  // 数组格式
      data.data?.audio_url ||                // 直接 URL
      (typeof data.data?.audio === 'string' && data.data.audio.startsWith('http')
        ? data.data.audio                    // 字符串 URL
        : null)

    if (!audioUrl) {
      // 可能是 hex 格式（未启用 output_format=url 时）
      if (typeof data.data?.audio === 'string' && data.data.audio.length > 100) {
        throw new Error('MiniMax 返回 hex 格式，未配置 output_format=url')
      }
      throw new Error(`MiniMax 未返回 audio_url: ${JSON.stringify(data).slice(0, 500)}`)
    }

    console.log(`[minimax] creation #${opts.creationId} 生成完成: ${audioUrl.slice(0, 80)}...`)
    return { audioUrl, taskId: data.data?.task_id }
  } finally {
    clearTimeout(timeout)
  }
}
