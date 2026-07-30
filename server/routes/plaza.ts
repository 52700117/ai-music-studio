/**
 * 歌曲广场路由：列表、试听计数、改编计数
 */
import { Router, type Request, type Response } from 'express'
import { db, ensureInitialized } from '../db.js'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const result = await db.execute(
    `SELECT id, creation_id, title, author, cover_color,
            play_count, remix_count, shared_at
     FROM plaza_song
     ORDER BY shared_at DESC`,
  )

  res.json({
    success: true,
    list: result.rows.map((r: any) => ({
      id: r.id,
      creationId: r.creation_id,
      title: r.title,
      author: r.author,
      coverColor: r.cover_color,
      playCount: r.play_count,
      remixCount: r.remix_count,
      sharedAt: r.shared_at,
    })),
  })
})

/**
 * 试听：播放数 +1
 */
router.post('/:id/play', async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  await db.execute({
    sql: 'UPDATE plaza_song SET play_count = play_count + 1 WHERE id = ?',
    args: [id],
  })
  res.json({ success: true })
})

/**
 * 改编：改编数 +1，返回歌曲信息供编辑页载入
 */
router.post('/:id/remix', async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  const result = await db.execute({
    sql: 'SELECT * FROM plaza_song WHERE id = ?',
    args: [id],
  })
  const row = result.rows[0] as any
  if (!row) {
    res.status(404).json({ success: false, error: '歌曲不存在' })
    return
  }
  await db.execute({
    sql: 'UPDATE plaza_song SET remix_count = remix_count + 1 WHERE id = ?',
    args: [id],
  })
  res.json({
    success: true,
    song: {
      id: row.id,
      title: row.title,
      author: row.author,
      coverColor: row.cover_color,
    },
  })
})

export default router
