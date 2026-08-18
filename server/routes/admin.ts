/**
 * 管理员路由
 * - 登录
 * - 用户列表（脱敏）
 * - 建议列表
 * - 暂停 / 恢复软件
 */
import { Router, type Request, type Response } from 'express'
import { db, getAppActive, setAppActive, ensureInitialized } from '../db.js'
import { requireAdmin, createToken } from '../lib/auth.js'
import { maskPhone, maskNickname } from '../lib/crypto.js'

const router = Router()

/**
 * 管理员登录
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const { username, password } = req.body || {}
  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入账号密码' })
    return
  }
  const result = await db.execute({
    sql: 'SELECT * FROM admin WHERE username = ? AND password_hash = ?',
    args: [username, password],
  })
  const admin = result.rows[0] as any
  if (!admin) {
    res.status(401).json({ success: false, error: '账号或密码错误' })
    return
  }
  const token = createToken({ id: admin.id as number, role: 'admin' })
  res.json({ success: true, token })
})

/**
 * 验证当前管理员 token（用于前端打开后台时自动跳过登录）
 */
router.get('/me', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const admin = (req as any).admin
  if (!admin) {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }
  // 根据 token 里的 id 查一下管理员用户名返回
  const result = await db.execute({
    sql: 'SELECT id, username FROM admin WHERE id = ? LIMIT 1',
    args: [admin.id as number],
  })
  const row = result.rows[0] as any
  res.json({
    success: true,
    id: row?.id as number,
    username: (row?.username as string) || 'admin',
  })
})

/**
 * 当前软件状态
 */
router.get('/status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, active: await getAppActive() })
})

/**
 * 暂停 / 恢复软件
 */
router.post('/toggle-status', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { active } = req.body || {}
  if (typeof active !== 'boolean') {
    res.status(400).json({ success: false, error: '参数错误' })
    return
  }
  await setAppActive(active)
  res.json({ success: true, active: await getAppActive() })
})

/**
 * 用户列表（脱敏显示）
 */
router.get('/users', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const usersRes = await db.execute('SELECT * FROM user ORDER BY created_at DESC')
  const users = usersRes.rows as any[]
  const creationsRes = await db.execute(
    'SELECT user_id, COUNT(*) AS n FROM creation GROUP BY user_id',
  )
  const countMap = new Map<number, number>()
  creationsRes.rows.forEach((c: any) => countMap.set(c.user_id, c.n))

  res.json({
    success: true,
    list: users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      phone: u.phone_masked || (u.phone_encrypted ? '***' : null),
      wechat: u.wechat_nickname || (u.wechat_openid_encrypted ? '微信用户' : null),
      loginType: u.login_type,
      creationCount: countMap.get(u.id as number) || 0,
      paused: !!u.paused,
      createdAt: u.created_at,
    })),
  })
})

/**
 * 暂停 / 恢复某个用户
 */
router.post('/users/:id/toggle-pause', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  const { paused } = req.body || {}
  if (typeof paused !== 'boolean') {
    res.status(400).json({ success: false, error: '参数错误' })
    return
  }
  const info = await db.execute({
    sql: 'UPDATE user SET paused = ? WHERE id = ?',
    args: [paused ? 1 : 0, id],
  })
  if (info.rowsAffected === 0) {
    res.status(404).json({ success: false, error: '用户不存在' })
    return
  }
  res.json({ success: true, paused })
})

/**
 * 建议列表
 */
router.get('/suggestions', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const result = await db.execute(
    `SELECT s.id, s.content, s.resolved, s.created_at,
            u.nickname, u.phone_masked
     FROM suggestion s
     LEFT JOIN user u ON u.id = s.user_id
     ORDER BY s.created_at DESC`,
  )

  res.json({
    success: true,
    list: result.rows.map((r: any) => ({
      id: r.id,
      content: r.content,
      resolved: !!r.resolved,
      createdAt: r.created_at,
      from: r.nickname ? maskNickname(r.nickname as string) : '匿名用户',
    })),
  })
})

/**
 * 标记建议已处理
 */
router.post('/suggestions/:id/resolve', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  await db.execute({
    sql: 'UPDATE suggestion SET resolved = 1 WHERE id = ?',
    args: [id],
  })
  res.json({ success: true })
})

/**
 * 修改管理员密码
 */
router.post('/change-password', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as any).admin.id as number
  const { oldPassword, newPassword } = req.body || {}
  if (!oldPassword || !newPassword) {
    res.status(400).json({ success: false, error: '请输入完整' })
    return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ success: false, error: '新密码至少 6 位' })
    return
  }
  const result = await db.execute({
    sql: 'SELECT id FROM admin WHERE id = ? AND password_hash = ?',
    args: [adminId, oldPassword],
  })
  if (!result.rows[0]) {
    res.status(401).json({ success: false, error: '原密码错误' })
    return
  }
  await db.execute({
    sql: 'UPDATE admin SET password_hash = ? WHERE id = ?',
    args: [newPassword, adminId],
  })
  res.json({ success: true })
})

/**
 * 统计概览
 */
router.get('/stats', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const userCount = (await db.execute('SELECT COUNT(*) AS n FROM user')).rows[0] as any
  const creationCount = (await db.execute('SELECT COUNT(*) AS n FROM creation')).rows[0] as any
  const suggestionCount = (await db.execute('SELECT COUNT(*) AS n FROM suggestion')).rows[0] as any
  const plazaCount = (await db.execute('SELECT COUNT(*) AS n FROM plaza_song')).rows[0] as any
  res.json({
    success: true,
    stats: {
      users: userCount.n,
      creations: creationCount.n,
      suggestions: suggestionCount.n,
      plaza: plazaCount.n,
      active: await getAppActive(),
    },
  })
})

export default router
