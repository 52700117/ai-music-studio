/**
 * MiniMax Music Generation API 接入
 * - 国内可访问、免费额度、支持高保真人声
 * - 文档：https://platform.minimaxi.com
 * - 同步返回：data.audio (URL 或 hex)，data.status: 1=生成中, 2=完成
 *
 * 环境变量：MINIMAX_API_KEY
 */
import crypto from 'crypto'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
// 国内平台用 api.minimaxi.com，国际平台用 api.minimax.io
const BASE = process.env.MINIMAX_BASE || 'https://api.minimaxi.com/v1'

export function isMiniMaxEnabled(): boolean {
  return !!MINIMAX_API_KEY
}

interface GenerateOptions {
  prompt: string
  lyrics?: string
  voice?: 'male' | 'female'
  mode?: 'original' | 'lyrics' | 'pure' | 'remix'
  creationId: number
}

interface MiniMaxResult {
  audioUrl: string
  taskId?: string
}

/**
 * 构造请求体
 * music-2.5 模型说明：
 * - lyrics 必填（1-3500 字符），可使用 [Verse]/[Chorus]/[Bridge] 等段落标签
 * - 如需纯音乐，lyrics 用 "[Intro]\n[Outro]" 并在 prompt 加 "pure music, no lyrics"
 * - lyrics_optimizer=true 可根据 prompt 自动生成歌词
 */
function buildRequestBody(opts: GenerateOptions): any {
  const { prompt, lyrics, voice, mode } = opts

  const isInstrumental = mode === 'pure'
  const hasLyrics = !!lyrics?.trim()

  // prompt 拼接：用户输入 + 风格提示
  let fullPrompt = prompt.slice(0, 1500)
  if (voice === 'male') fullPrompt += ', male vocal'
  else if (voice === 'female') fullPrompt += ', female vocal'

  if (isInstrumental) {
    fullPrompt += ', pure music, no lyrics, instrumental'
  }

  // lyrics 处理
  let finalLyrics: string
  let lyricsOptimizer = false

  if (isInstrumental) {
    // 纯音乐：用占位段落标签
    finalLyrics = '[Intro]\n[Outro]'
  } else if (hasLyrics) {
    // 用户提供了歌词
    finalLyrics = lyrics!.slice(0, 3500)
  } else {
    // 没提供歌词：让 MiniMax 根据 prompt 自动生成
    finalLyrics = '[Verse]\n[Chorus]'
    lyricsOptimizer = true
  }

  return {
    model: 'music-2.5',
    prompt: fullPrompt,
    lyrics: finalLyrics,
    lyrics_optimizer: lyricsOptimizer,
    output_format: 'url', // 直接返回 URL，不用解码 hex
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    },
  }
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
