/**
 * 软件状态路由（公开，无需鉴权）
 * 前端据此判断是否进入维护页
 */
import { Router, type Request, type Response } from 'express'
import { getAppActive, ensureInitialized } from '../db.js'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  res.json({ success: true, active: await getAppActive() })
})

export default router
