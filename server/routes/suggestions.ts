/**
 * 建议反馈路由
 */
import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'
import { requireUser } from '../lib/auth.js'

const router = Router()

router.post('/', requireUser, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id
  const { content } = req.body || {}
  if (!content || !String(content).trim()) {
    res.status(400).json({ success: false, error: '请输入建议内容' })
    return
  }
  const info = await db.execute({
    sql: 'INSERT INTO suggestion (user_id, content) VALUES (?, ?)',
    args: [userId, String(content).trim().slice(0, 1000)],
  })
  res.json({ success: true, id: Number(info.lastInsertRowid) })
})

export default router
