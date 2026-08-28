/**
 * 用户认证路由：账号密码注册/登录（真实）
 * 兼容旧版手机/微信登录（已弃用，仅保留接口不报错）
 */
import { Router, type Request, type Response } from 'express'
import { db, ensureInitialized } from '../db.js'
import { encrypt, maskPhone, maskNickname, hashPassword, verifyPassword } from '../lib/crypto.js'
import { createToken, verifyToken } from '../lib/auth.js'

const router = Router()

interface RegisterBody {
  username: string
  password: string
  nickname?: string
}

interface LoginBody {
  // 新版：账号密码
  username?: string
  password?: string
  // 旧版兼容（已弃用）
  type?: 'wechat' | 'phone'
  phone?: string
  code?: string
  nickname?: string
}

/**
 * 用户名规则：3-20 位，字母/数字/下划线，必须以字母开头
 */
function isValidUsername(username: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(username)
}

/**
 * 密码规则：6-64 位，至少包含字母和数字
 */
function isValidPassword(password: string): boolean {
  if (password.length < 6 || password.length > 64) return false
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  return hasLetter && hasNumber
}

/**
 * 注册：用户名 + 密码
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const { username, password, nickname } = (req.body || {}) as RegisterBody

  if (!username || !isValidUsername(username)) {
    res.status(400).json({ success: false, error: '用户名需 3-20 位，字母开头，仅含字母/数字/下划线' })
    return
  }
  if (!password || !isValidPassword(password)) {
    res.status(400).json({ success: false, error: '密码需 6-64 位，至少包含字母和数字' })
    return
  }

  // 检查用户名是否已存在
  const existing = await db.execute({
    sql: 'SELECT id FROM user WHERE username = ?',
    args: [username],
  })
  if (existing.rows.length > 0) {
    res.status(409).json({ success: false, error: '该用户名已被注册' })
    return
  }

  const passwordHash = hashPassword(password)
  const displayName = (nickname?.trim() || username).slice(0, 30)

  const info = await db.execute({
    sql: `INSERT INTO user (nickname, username, password_hash, password_updated_at, login_type)
          VALUES (?, ?, ?, datetime('now'), 'password')`,
    args: [displayName, username, passwordHash],
  })

  const userId = Number(info.lastInsertRowid)
  const token = createToken({ id: userId, role: 'user', type: 'password' })

  res.json({
    success: true,
    token,
    user: {
      id: userId,
      nickname: displayName,
      username,
      loginType: 'password',
    },
  })
})

/**
 * 登录：用户名 + 密码
 * 兼容旧版手机/微信登录（type=phone/wechat 时仍走旧逻辑）
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  await ensureInitialized()
  const { username, password, type, phone, code, nickname } = (req.body || {}) as LoginBody

  // 新版：账号密码登录
  if (username && password) {
    const result = await db.execute({
      sql: 'SELECT * FROM user WHERE username = ?',
      args: [username],
    })
    const user = result.rows[0] as any
    if (!user || !user.password_hash) {
      res.status(401).json({ success: false, error: '用户名或密码错误' })
      return
    }
    if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({ success: false, error: '用户名或密码错误' })
      return
    }

    const userId = Number(user.id)
    const token = createToken({ id: userId, role: 'user', type: 'password' })
    res.json({
      success: true,
      token,
      user: {
        id: userId,
        nickname: user.nickname,
        username: user.username,
        loginType: 'password',
      },
    })
    return
  }

  // 旧版兼容：手机号登录
  if (type === 'phone') {
    if (!phone || !/^\d{11}$/.test(phone)) {
      res.status(400).json({ success: false, error: '手机号格式不正确' })
      return
    }
    if (!code || code.length < 4) {
      res.status(400).json({ success: false, error: '验证码不正确' })
      return
    }

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

    const userId = Number(user.id)
    const token = createToken({ id: userId, role: 'user', type: 'phone' })
    res.json({
      success: true,
      token,
      user: {
        id: userId,
        nickname: user.nickname,
        phoneMasked: user.phone_masked,
        loginType: 'phone',
      },
    })
    return
  }

  // 旧版兼容：微信登录
  if (type === 'wechat') {
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

    const userId = Number(user.id)
    const token = createToken({ id: userId, role: 'user', type: 'wechat' })
    res.json({
      success: true,
      token,
      user: {
        id: userId,
        nickname: user.nickname,
        wechatMasked: maskNickname(user.nickname as string),
        loginType: 'wechat',
      },
    })
    return
  }

  res.status(400).json({ success: false, error: '请提供用户名和密码' })
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
      username: user.username,
      phoneMasked: user.phone_masked,
      wechatMasked: user.wechat_nickname,
      loginType: user.login_type,
      // 扩展字段
      bio: user.bio || '',
      gender: user.gender || '',
      avatar: user.avatar || '',
    },
  })
})

/**
 * 更新个人资料（昵称、简介、性别、头像）
 */
router.patch('/me', async (req, res): Promise<void> => {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  const payload = verifyToken(auth)
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }
  await ensureInitialized()

  const body = (req.body || {}) as {
    nickname?: string
    bio?: string
    gender?: string
    avatar?: string
  }

  const updates: string[] = []
  const args: any[] = []

  if (body.nickname !== undefined) {
    const nick = body.nickname.trim().slice(0, 30)
    if (!nick) {
      res.status(400).json({ success: false, error: '昵称不能为空' })
      return
    }
    updates.push('nickname = ?')
    args.push(nick)
  }
  if (body.bio !== undefined) {
    updates.push('bio = ?')
    args.push(body.bio.trim().slice(0, 200))
  }
  if (body.gender !== undefined) {
    const g = body.gender
    if (g && !['male', 'female', 'other'].includes(g)) {
      res.status(400).json({ success: false, error: '性别值无效' })
      return
    }
    updates.push('gender = ?')
    args.push(g || null)
  }
  if (body.avatar !== undefined) {
    // 简单验证：非空字符串或空
    if (body.avatar && body.avatar.length > 2000) {
      res.status(400).json({ success: false, error: '头像数据过长' })
      return
    }
    updates.push('avatar = ?')
    args.push(body.avatar || null)
  }

  if (updates.length === 0) {
    res.status(400).json({ success: false, error: '没有要更新的内容' })
    return
  }

  args.push(payload.id)
  await db.execute({
    sql: `UPDATE user SET ${updates.join(', ')} WHERE id = ?`,
    args,
  })

  // 返回更新后的用户信息
  const result = await db.execute({
    sql: 'SELECT * FROM user WHERE id = ?',
    args: [payload.id],
  })
  const user = result.rows[0] as any
  res.json({
    success: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      username: user.username,
      phoneMasked: user.phone_masked,
      wechatMasked: user.wechat_nickname,
      loginType: user.login_type,
      bio: user.bio || '',
      gender: user.gender || '',
      avatar: user.avatar || '',
    },
  })
})

/**
 * 修改密码（需验证旧密码）
 */
router.post('/change-password', async (req, res): Promise<void> => {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  const payload = verifyToken(auth)
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }
  await ensureInitialized()

  const { oldPassword, newPassword } = (req.body || {}) as {
    oldPassword?: string
    newPassword?: string
  }

  if (!oldPassword) {
    res.status(400).json({ success: false, error: '请输入旧密码' })
    return
  }
  if (!newPassword || !isValidPassword(newPassword)) {
    res.status(400).json({ success: false, error: '新密码需 6-64 位，至少包含字母和数字' })
    return
  }
  if (oldPassword === newPassword) {
    res.status(400).json({ success: false, error: '新密码不能与旧密码相同' })
    return
  }

  const result = await db.execute({
    sql: 'SELECT * FROM user WHERE id = ?',
    args: [payload.id],
  })
  const user = result.rows[0] as any
  if (!user || !user.password_hash) {
    res.status(400).json({ success: false, error: '该账号没有密码，请用其他方式登录' })
    return
  }
  if (!verifyPassword(oldPassword, user.password_hash)) {
    res.status(400).json({ success: false, error: '旧密码不正确' })
    return
  }

  const newHash = hashPassword(newPassword)
  await db.execute({
    sql: 'UPDATE user SET password_hash = ?, password_updated_at = datetime(\'now\') WHERE id = ?',
    args: [newHash, payload.id],
  })

  res.json({ success: true })
})

export default router
