/**
 * 简易鉴权：基于 HMAC 签名的 token
 * 格式：base64(payload).signature
 * payload 包含 id / role / 登录方式
 * 不引入额外依赖，适合演示；生产环境建议使用成熟 JWT 库
 */
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { db, ensureInitialized } from '../db.js'

const SECRET = process.env.TOKEN_SECRET || 'music-app-token-secret-2026'

interface TokenPayload {
  id: number
  role: 'user' | 'admin'
  type?: string
}

function sign(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body)
  // 时间安全比较
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
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
  if (!payload || payload.role !== 'admin') {
    res.status(401).json({ success: false, error: '管理员未登录' })
    return
  }
  ;(req as any).admin = payload
  next()
}
