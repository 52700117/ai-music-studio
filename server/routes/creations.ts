/**
 * 创作路由
 * - 提交创作：写入 processing 记录，如启用 Suno 则异步生成
 * - 查询状态：根据 elapsed 模拟推进；启用 Suno 时等音频就绪再完成
 * - 我的创作列表
 * - 分享到广场
 *
 * 音频文件：不下载到本地（Vercel 文件系统只读）
 * 直接把 Suno 返回的 audioUrl 存库，前端用 CDN URL 播放
 */
import { Router, type Request, type Response } from 'express'
import { db, ensureInitialized } from '../db.js'
import { requireUser } from '../lib/auth.js'
import { isStableAudioEnabled, generateAudio } from '../lib/stableAudio.js'
import { isMusicGenEnabled, generateMusic } from '../lib/musicGen.js'
import { isMiniMaxEnabled, generateMusicWithMiniMax } from '../lib/minimax.js'

const router = Router()

interface CreateBody {
  mode: 'original' | 'lyrics' | 'pure' | 'remix'
  prompt?: string
  voice?: 'male' | 'female'
  sourceSongId?: number
  audioName?: string
}

const TITLES = ['无题', '灵感片段', '深夜曲', '清晨谣', '随想', '光与影', '回响', '微光']
const COLORS = ['#FF4D2E', '#1F3A2E', '#3B5BA5', '#E8A33D', '#7A4FB8', '#2A9D8F']

// 生成器优先级：MiniMax（国内免费+人声）> MusicGen（HF 免费）> Suno（ACEDATA 收费）
// 都没配置时走前端合成器降级
const MINIMAX_ENABLED = isMiniMaxEnabled()
const SUNO_ENABLED = isStableAudioEnabled()
const MUSICGEN_ENABLED = isMusicGenEnabled()
const AI_ENABLED = MINIMAX_ENABLED || MUSICGEN_ENABLED || SUNO_ENABLED
// AI 生成 30-90 秒，给 180 秒冗余；未启用时 6 秒模拟（前端合成器）
const DURATION_MS = AI_ENABLED ? 180000 : 6000

router.post('/', requireUser, async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const userId = (req as any).user.id
  const { mode, prompt, voice, sourceSongId, audioName } = (req.body || {}) as CreateBody

  if (!['original', 'lyrics', 'pure', 'remix'].includes(mode)) {
    res.status(400).json({ success: false, error: '无效的创作模式' })
    return
  }
  if (mode === 'original' && !prompt?.trim() && !audioName?.trim()) {
    res.status(400).json({ success: false, error: '请填写创作要求或放入歌词' })
    return
  }

  const title = TITLES[Math.floor(Math.random() * TITLES.length)]
  const info = await db.execute({
    sql: `INSERT INTO creation (user_id, mode, prompt, voice, source_song_id, audio_name, status, progress)
          VALUES (?, ?, ?, ?, ?, ?, 'processing', 0)`,
    args: [userId, mode, prompt || null, voice || null, sourceSongId || null, audioName || title],
  })

  const creationId = info.lastInsertRowid as unknown as number

  // 如启用 AI 生成，异步触发（不等待，避免 HTTP 超时）
  if (AI_ENABLED) {
    // 从 prompt 里提取歌词（Editor 合并时加了 "歌词：\n" 前缀）
    let lyrics: string | undefined
    let cleanPrompt = prompt || title
    const lyricsMatch = prompt?.match(/歌词：\n([\s\S]*?)$/)
    if (lyricsMatch) {
      lyrics = lyricsMatch[1].trim()
      cleanPrompt = prompt!.replace(/\n\n歌词：\n[\s\S]*?$/, '').trim() || title
    }
    triggerGeneration(creationId, mode, cleanPrompt, voice, lyrics)
  }

  res.json({ success: true, id: Number(creationId), status: 'processing', title })
})

/**
 * 异步生成音乐：优先 MiniMax（国内免费+人声）→ MusicGen（HF 免费）→ Suno（收费）
 * 都失败则保持 audio_url=null，前端用本地合成器降级播放
 */
async function triggerGeneration(
  creationId: number,
  mode: string,
  prompt: string,
  voice?: string,
  lyrics?: string,
): Promise<void> {
  const voiceHint = voice === 'male' ? 'male vocal' : voice === 'female' ? 'female vocal' : ''
  const modeHint =
    mode === 'pure' ? 'instrumental' :
    mode === 'remix' ? 'creative remix' : ''
  const fullPrompt = [prompt.slice(0, 500), modeHint, voiceHint].filter(Boolean).join(', ')

  // 1) 优先尝试 MiniMax（国内可访问、免费、带人声）
  if (MINIMAX_ENABLED) {
    try {
      console.log(`[minimax] creation #${creationId} 开始生成...`)
      const result = await generateMusicWithMiniMax({
        prompt: fullPrompt,
        lyrics,
        voice: voice as 'male' | 'female' | undefined,
        mode: mode as 'original' | 'lyrics' | 'pure' | 'remix',
        creationId,
      })
      await db.execute({
        sql: 'UPDATE creation SET audio_url = ?, status = ? WHERE id = ?',
        args: [result.audioUrl, 'completed', creationId],
      })
      console.log(`[minimax] creation #${creationId} 生成完成: ${result.audioUrl.slice(0, 80)}`)
      return
    } catch (e: any) {
      console.error(`[minimax] creation #${creationId} 生成失败，降级到 MusicGen:`, e.message)
      // 继续往下尝试
    }
  }

  // 2) 备选：MusicGen（Hugging Face 免费）
  if (MUSICGEN_ENABLED) {
    try {
      console.log(`[musicgen] creation #${creationId} 开始生成...`)
      const result = await generateMusic({
        prompt: fullPrompt,
        creationId,
        durationSec: 20,
      })
      await db.execute({
        sql: 'UPDATE creation SET audio_url = ?, status = ? WHERE id = ?',
        args: [result.audioUrl, 'completed', creationId],
      })
      console.log(`[musicgen] creation #${creationId} 生成完成: ${result.audioUrl}`)
      return
    } catch (e: any) {
      console.error(`[musicgen] creation #${creationId} 生成失败，降级到 Suno:`, e.message)
      // 继续往下尝试 Suno
    }
  }

  // 3) 备选：Suno（ACEDATA 收费，余额可能不足）
  if (SUNO_ENABLED) {
    try {
      console.log(`[suno] creation #${creationId} 开始生成...`)
      const result = await generateAudio({
        prompt: fullPrompt,
        lyrics,
        title: `作品${creationId}`,
      })
      await db.execute({
        sql: 'UPDATE creation SET audio_url = ? WHERE id = ?',
        args: [result.audioUrl, creationId],
      })
      console.log(`[suno] creation #${creationId} 生成完成: ${result.audioUrl}`)
      return
    } catch (e: any) {
      console.error(`[suno] creation #${creationId} 生成失败:`, e.message)
    }
  }

  // 4) 都失败：保持 audio_url=null，前端用本地合成器播放
  console.warn(`[generation] creation #${creationId} AI 生成均失败，前端将降级到合成器`)
}

/**
 * 查询创作进度
 */
router.get('/:id', requireUser, async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const userId = (req as any).user.id
  const id = Number(req.params.id)
  const result = await db.execute({
    sql: 'SELECT * FROM creation WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })
  const row = result.rows[0] as any
  if (!row) {
    res.status(404).json({ success: false, error: '创作不存在' })
    return
  }

  if (row.status === 'completed') {
    res.json({
      success: true,
      id: row.id,
      status: 'completed',
      progress: 100,
      title: row.audio_name,
      mode: row.mode,
      audioUrl: row.audio_url || null,
    })
    return
  }

  const elapsed = Date.now() - new Date(row.created_at + 'Z').getTime()
  let progress = Math.min(100, Math.floor((elapsed / DURATION_MS) * 100))
  if (progress > 95 && progress < 100) progress = 95

  if (AI_ENABLED) {
    if (row.audio_url) {
      await db.execute({
        sql: 'UPDATE creation SET status = ?, progress = 100 WHERE id = ?',
        args: ['completed', id],
      })
      res.json({
        success: true,
        id: row.id,
        status: 'completed',
        progress: 100,
        title: row.audio_name,
        mode: row.mode,
        audioUrl: row.audio_url,
      })
    } else if (progress >= 100) {
      await db.execute({
        sql: 'UPDATE creation SET status = ?, progress = 100 WHERE id = ?',
        args: ['completed', id],
      })
      res.json({
        success: true,
        id: row.id,
        status: 'completed',
        progress: 100,
        title: row.audio_name,
        mode: row.mode,
        audioUrl: null,
      })
    } else {
      await db.execute({
        sql: 'UPDATE creation SET progress = ? WHERE id = ?',
        args: [progress, id],
      })
      res.json({ success: true, id: row.id, status: 'processing', progress, title: row.audio_name, mode: row.mode, audioUrl: null })
    }
  } else {
    if (progress >= 100) {
      await db.execute({
        sql: 'UPDATE creation SET status = ?, progress = 100 WHERE id = ?',
        args: ['completed', id],
      })
      res.json({
        success: true,
        id: row.id,
        status: 'completed',
        progress: 100,
        title: row.audio_name,
        mode: row.mode,
        audioUrl: null,
      })
    } else {
      await db.execute({
        sql: 'UPDATE creation SET progress = ? WHERE id = ?',
        args: [progress, id],
      })
      res.json({ success: true, id: row.id, status: 'processing', progress, title: row.audio_name, mode: row.mode, audioUrl: null })
    }
  }
})

/**
 * 我的创作列表
 */
router.get('/mine/list', requireUser, async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const userId = (req as any).user.id
  const result = await db.execute({
    sql: `SELECT c.id, c.mode, c.prompt, c.voice, c.audio_name, c.audio_url, c.status, c.created_at,
                 p.id AS plaza_id
          FROM creation c
          LEFT JOIN plaza_song p ON p.creation_id = c.id
          WHERE c.user_id = ?
          ORDER BY c.created_at DESC`,
    args: [userId],
  })

  res.json({
    success: true,
    list: result.rows.map((r: any) => ({
      id: r.id,
      mode: r.mode,
      prompt: r.prompt,
      voice: r.voice,
      title: r.audio_name,
      status: r.status,
      audioUrl: r.audio_url || null,
      createdAt: r.created_at,
      shared: !!r.plaza_id,
    })),
  })
})

/**
 * 分享到广场
 */
router.post('/:id/share', requireUser, async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const userId = (req as any).user.id
  const id = Number(req.params.id)
  const result = await db.execute({
    sql: 'SELECT * FROM creation WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })
  const row = result.rows[0] as any
  if (!row) {
    res.status(404).json({ success: false, error: '创作不存在' })
    return
  }
  if (row.status !== 'completed') {
    res.status(400).json({ success: false, error: '作品尚未完成' })
    return
  }

  const existingRes = await db.execute({
    sql: 'SELECT id FROM plaza_song WHERE creation_id = ?',
    args: [id],
  })
  const existing = existingRes.rows[0] as any
  if (existing) {
    res.json({ success: true, plazaId: existing.id })
    return
  }

  const authorRes = await db.execute({
    sql: 'SELECT nickname FROM user WHERE id = ?',
    args: [userId],
  })
  const author = authorRes.rows[0] as any
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]
  const info = await db.execute({
    sql: 'INSERT INTO plaza_song (creation_id, title, author, cover_color) VALUES (?, ?, ?, ?)',
    args: [id, row.audio_name, author.nickname, color],
  })

  res.json({ success: true, plazaId: Number(info.lastInsertRowid) })
})

export default router
