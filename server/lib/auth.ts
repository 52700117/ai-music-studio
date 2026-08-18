/**
 * 简易鉴权：基于 HMAC 签名的 token
 * 格式：base64(payload).signature
 * payload 包含 id / role / 登录方式 / exp（过期时间戳）
 * 不引入额外依赖，适合演示；生产环境建议使用成熟 JWT 库
 */
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { db, ensureInitialized } from '../db.js'

const SECRET = process.env.TOKEN_SECRET || 'music-app-token-secret-2026'

// 过期时间：严格模式：管理员 2 小时（每次打开尽量要求重新登录），普通用户 7 天
export const TOKEN_EXPIRY = {
  admin: 2 * 60 * 60,        // 2 小时（更严格：关标签页立刻失效靠前端 sessionStorage）
  user: 7 * 24 * 60 * 60,    // 7 天
} as const

interface TokenPayload {
  id: number
  role: 'user' | 'admin'
  type?: string
  exp?: number // 过期时间（Unix 时间戳，秒）
  iat?: number // 签发时间（Unix 时间戳，秒）
  v?: number // 版本号：管理员 token 必须 >=2（老版本无此字段一律判无效，关浏览器再打开必重登）
}

function sign(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createToken(payload: TokenPayload): string {
  const now = Math.floor(Date.now() / 1000)
  const expiry = TOKEN_EXPIRY[payload.role] || TOKEN_EXPIRY.user
  const full: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiry,
    // 管理员 token 强制打版本号，旧缓存 JS 签发的 token 一律不通过
    ...(payload.role === 'admin' ? { v: 2 } : {}),
  }
  const body = Buffer.from(JSON.stringify(full)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body)
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
    // 检查过期
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 普通用户鉴权中间件（异步：查数据库）
 */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  await ensureInitialized()
  const token = req.headers.authorization?.replace('Bearer ', '')
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }
  // 检查用户是否被管理员暂停
  const result = await db.execute({
    sql: 'SELECT paused FROM user WHERE id = ?',
    args: [payload.id],
  })
  const row = result.rows[0] as { paused?: number } | undefined
  if (row?.paused) {
    res.status(403).json({ success: false, error: '账号已被暂停，请联系管理员', code: 'PAUSED' })
    return
  }
  ;(req as any).user = payload
  next()
}

/**
 * 管理员鉴权中间件
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await ensureInitialized()
  const token = req.headers.authorization?.replace('Bearer ', '')
  const payload = verifyToken(token)
  // 严格模式：管理员必须有版本号字段 v >= 2
  //   → 老版本 localStorage 里永久缓存的旧 token（payload 里没有 v）即使被旧 JS 读到也一律判 401
  //   → 配合前端「关标签页清内存态」保证关了再打开必须重输密码
  if (!payload || payload.role !== 'admin' || !payload.v || payload.v < 2) {
    res.status(401).json({ success: false, error: '管理员未登录' })
    return
  }
  ;(req as any).admin = payload
  next()
}
