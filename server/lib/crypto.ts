/**
 * 隐私保护工具：加密 / 脱敏
 * - 手机号、微信 openid 入库前加密存储
 * - 对外展示一律脱敏（保留前3后4）
 * 使用 Node 内置 crypto，AES-256-GCM
 */
import crypto from 'crypto'

// 演示用密钥（生产环境应从环境变量读取并妥善保管）
const SECRET_KEY = process.env.SECRET_KEY || 'music-app-demo-secret-key-32byte!!!'
const KEY = crypto.createHash('sha256').update(SECRET_KEY).digest().subarray(0, 32)

/**
 * 加密明文
 */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv(12) + tag(16) + 密文，整体 base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * 解密
 */
export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * 手机号脱敏：138****1234
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

/**
 * 微信昵称脱敏：保留首尾字符
 */
export function maskNickname(name: string): string {
  if (!name) return '微信用户'
  if (name.length <= 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

/**
 * 密码哈希：PBKDF2 + 盐
 * 返回格式：salt:iterations:hash（都是 hex）
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const iterations = 100000
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex')
  return `${salt}:${iterations}:${hash}`
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false
  const [salt, iterStr, hash] = stored.split(':')
  if (!salt || !iterStr || !hash) return false
  const iterations = parseInt(iterStr, 10)
  const testHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex')
  // 时间安全比较
  if (testHash.length !== hash.length) return false
  return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(hash))
}
