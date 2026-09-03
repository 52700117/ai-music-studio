/**
 * Hugging Face Inference API - MusicGen 封装
 *
 * MusicGen 是 Meta 开源的音乐生成模型，通过 Hugging Face 托管推理 API 调用。
 * - 免费（受限于每分钟调用次数和繁忙时段）
 * - 生成耗时 30-60 秒
 * - 返回 audio/wav 二进制
 *
 * 文档：https://huggingface.co/docs/api-inference
 * 模型：facebook/musicgen-small（轻量、相对快）
 *
 * 调用流程：
 *   POST https://api-inference.huggingface.co/models/facebook/musicgen-small
 *   body: { inputs: "prompt 描述" }
 *   返回：audio/wav 二进制 → 上传到 /data 卷 → 存路径
 */
import fs from 'fs'
import path from 'path'

const HF_BASE = 'https://api-inference.huggingface.co/models'
// small 模型较快；medium 质量更好但慢。优先 small，超时/失败可切 medium。
const DEFAULT_MODEL = process.env.MUSICGEN_MODEL || 'facebook/musicgen-small'

// 音频输出目录优先级：
//   1. Railway/Render/自有 Volume：RAILWAY_VOLUME_MOUNT_PATH / DATA_VOLUME_MOUNT_PATH
//   2. CloudBase 云函数：/tmp（512MB 临时可写，重启不保留，但生成后 base64 返回不依赖持久化）
//   3. 本地源码：项目根 /data/audio
function resolveAudioDir(): string {
  const mount = process.env.DATA_VOLUME_MOUNT_PATH || process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.RENDER_DISK_PATH
  if (mount) return path.join(mount, 'audio')
  // CloudBase/SCF 云函数运行时特征：SCF_RUNTIME 或 TENCENTCLOUD_SECRETID 存在
  if (process.env.SCF_RUNTIME || process.env._SCF_TIMESTAMP || process.env.TENCENTCLOUD_SECRETID) {
    return '/tmp/ai-music-audio'
  }
  return path.resolve(process.cwd(), 'data/audio')
}
const AUDIO_DIR = resolveAudioDir()

function getToken(): string | null {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || null
}

export function isMusicGenEnabled(): boolean {
  return !!getToken()
}

/**
 * 根据 prompt 生成音频文件
 * 返回：本地可访问的 URL 路径（/audio/xxx.wav），前端可直接播放
 */
export async function generateMusic(opts: {
  prompt: string
  durationSec?: number
  creationId: number
}): Promise<{ audioUrl: string; finishReason: string }> {
  const token = getToken()
  if (!token) throw new Error('HF_TOKEN 未配置')

  // MusicGen 提示词建议用英文，效果更稳定
  const prompt = translatePrompt(opts.prompt)

  // 确保音频目录存在
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000) // 90 秒超时

  try {
    console.log(`[musicgen] creation #${opts.creationId} 开始生成: "${prompt}"`)

    const res = await fetch(`${HF_BASE}/${DEFAULT_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          duration: opts.durationSec || 15, // 秒数，small 模型建议 15-30
          temperature: 0.9, // 略带随机，避免每次相同
          guidance_scale: 3,
        },
        options: { wait_for_model: true },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`HF 调用失败 (${res.status}): ${errText.slice(0, 300)}`)
    }

    // 返回的是 audio/wav 二进制
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('audio')) {
      const text = await res.text().catch(() => '')
      throw new Error(`HF 返回非音频: ${text.slice(0, 300)}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const filename = `creation-${opts.creationId}-${Date.now()}.wav`
    const filepath = path.resolve(AUDIO_DIR, filename)
    fs.writeFileSync(filepath, buffer)

    // 返回给前端的 URL（server.ts 中 /audio 已映射到 audioDir）
    const audioUrl = `/audio/${filename}`
    console.log(`[musicgen] creation #${opts.creationId} 生成完成: ${audioUrl} (${buffer.length} bytes)`)
    return { audioUrl, finishReason: 'succeeded' }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 简单中英文 prompt 翻译/补全
 * MusicGen 主要训练在英文上，中文效果差，所以做基础映射
 */
function translatePrompt(rawPrompt: string): string {
  let p = rawPrompt || ''
  const map: Record<string, string> = {
    '欢快': 'cheerful, upbeat',
    '快乐': 'happy, upbeat',
    '悲伤': 'sad, melancholic',
    '深夜': 'late night, calm, ambient',
    '清晨': 'morning, fresh, bright',
    '夏天': 'summer, bright',
    '冬日': 'winter, cold',
    '激烈': 'intense, energetic',
    '宁静': 'peaceful, serene',
    '梦境': 'dreamy, ethereal',
    '摇滚': 'rock',
    '流行': 'pop',
    '爵士': 'jazz',
    '电子': 'electronic',
    '古典': 'classical',
    '钢琴': 'piano',
    '吉他': 'guitar',
    '女声': 'female vocal',
    '男声': 'male vocal',
    '纯音乐': 'instrumental',
    '改编': 'remix',
  }
  for (const [zh, en] of Object.entries(map)) {
    p = p.replace(new RegExp(zh, 'g'), en)
  }
  // 保留英文部分，长度限制
  p = p.replace(/[^\x00-\x7F]/g, '').trim()
  if (p.length < 5) p = 'instrumental music, calm, melodic'
  if (p.length > 200) p = p.slice(0, 200)
  return p
}
