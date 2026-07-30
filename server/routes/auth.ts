/**
 * 用户认证路由：微信登录 / 手机号登录
 * 演示环境：无需真实第三方，前端模拟授权码即可
 * 隐私：手机号加密入库，对外仅返回脱敏
 */
import { Router, type Request, type Response } from 'express'
import { db, ensureInitialized } from '../db.js'
import { encrypt, maskPhone, maskNickname } from '../lib/crypto.js'
import { createToken, verifyToken } from '../lib/auth.js'

const router = Router()

interface LoginBody {
  type: 'wechat' | 'phone'
  phone?: string
  code?: string
  nickname?: string
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const { type, phone, code, nickname } = (req.body || {}) as LoginBody

  if (type === 'phone') {
    if (!phone || !/^\d{11}$/.test(phone)) {
      res.status(400).json({ success: false, error: '手机号格式不正确' })
      return
    }
    if (!code || code.length < 4) {
      res.status(400).json({ success: false, error: '验证码不正确' })
      return
    }

    // 查找或创建用户（按加密手机号唯一）
    const phoneEncrypted = encrypt(phone)
    let result = await db.execute({
      sql: 'SELECT * FROM user WHERE phone_encrypted = ?',
      args: [phoneEncrypted],
    })
    let user = result.rows[0] as any

    if (!user) {
      const masked = maskPhone(phone)
      const info = await db.execute({
        sql: 'INSERT INTO user (nickname, phone_encrypted, phone_masked, login_type) VALUES (?, ?, ?, ?)',
        args: [`手机用户${masked.slice(-4)}`, phoneEncrypted, masked, 'phone'],
      })
      result = await db.execute({
        sql: 'SELECT * FROM user WHERE id = ?',
        args: [info.lastInsertRowid as unknown as number],
      })
      user = result.rows[0]
    }

    const token = createToken({ id: user.id as number, role: 'user', type: 'phone' })
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        phoneMasked: user.phone_masked,
        loginType: 'phone',
      },
    })
    return
  }

  if (type === 'wechat') {
    // 演示：用 code 当作伪 openid
    const openid = code || `wx_${Date.now()}`
    const openidEncrypted = encrypt(openid)
    let result = await db.execute({
      sql: 'SELECT * FROM user WHERE wechat_openid_encrypted = ?',
      args: [openidEncrypted],
    })
    let user = result.rows[0] as any

    if (!user) {
      const nick = nickname || `微信用户${Math.floor(Math.random() * 9000) + 1000}`
      const masked = maskNickname(nick)
      const info = await db.execute({
        sql: 'INSERT INTO user (nickname, wechat_openid_encrypted, wechat_nickname, login_type) VALUES (?, ?, ?, ?)',
        args: [nick, openidEncrypted, masked, 'wechat'],
      })
      result = await db.execute({
        sql: 'SELECT * FROM user WHERE id = ?',
        args: [info.lastInsertRowid as unknown as number],
      })
      user = result.rows[0]
    }

    const token = createToken({ id: user.id as number, role: 'user', type: 'wechat' })
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        wechatMasked: maskNickname(user.nickname as string),
        loginType: 'wechat',
      },
    })
    return
  }

  res.status(400).json({ success: false, error: '不支持的登录方式' })
})

/**
 * 获取当前登录用户信息
 */
router.get('/me', async (req, res): Promise<void> => {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  const payload = verifyToken(auth)
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }
  const result = await db.execute({
    sql: 'SELECT * FROM user WHERE id = ?',
    args: [payload.id],
  })
  const user = result.rows[0] as any
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' })
    return
  }
  res.json({
    success: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      phoneMasked: user.phone_masked,
      wechatMasked: user.wechat_nickname,
      loginType: user.login_type,
    },
  })
})

export default router
