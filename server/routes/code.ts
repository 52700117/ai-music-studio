/**
 * 代码查看 / 编辑路由（管理员）
 * - 列出前端可编辑源文件
 * - 读取 / 保存文件内容
 *
 * 注意：Vercel 部署时文件系统只读，写接口会返回提示
 * 安全：仅允许 src/ 与 api/ 目录白名单，禁止目录穿越
 */
import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { requireAdmin } from '../lib/auth.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 源码模式 / pkg 打包模式双兼容
const IS_PKG = typeof (process as any).pkg !== 'undefined'
const EXEC_DIR = path.dirname(process.execPath)
const SOURCE_ROOT = path.resolve(__dirname, '../..')
const PROJECT_ROOT = IS_PKG ? path.join(EXEC_DIR, 'resources') : SOURCE_ROOT

// 允许编辑的目录白名单（相对项目根）
const ALLOWED_DIRS = ['src', 'server']
// 允许的扩展名
const ALLOWED_EXT = ['.tsx', '.ts', '.css', '.js']

// Vercel 部署时文件系统只读
const IS_READ_ONLY = !!process.env.VERCEL

function isPathSafe(relPath: string): boolean {
  if (!relPath) return false
  if (path.isAbsolute(relPath)) return false
  if (relPath.includes('..')) return false
  const top = relPath.split('/')[0]
  if (!ALLOWED_DIRS.includes(top)) return false
  const ext = path.extname(relPath).toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) return false
  const full = path.resolve(PROJECT_ROOT, relPath)
  // 确保仍在项目根内
  if (!full.startsWith(PROJECT_ROOT + path.sep)) return false
  return fs.existsSync(full)
}

function walk(dir: string, base: string, acc: { path: string; name: string }[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue
    const full = path.join(dir, e.name)
    const rel = path.relative(base, full).split(path.sep).join('/')
    if (e.isDirectory()) {
      walk(full, base, acc)
    } else if (ALLOWED_EXT.includes(path.extname(e.name).toLowerCase())) {
      acc.push({ path: rel, name: e.name })
    }
  }
}

/**
 * 列出可编辑文件
 */
router.get('/files', requireAdmin, (_req: Request, res: Response): void => {
  const files: { path: string; name: string }[] = []
  for (const d of ALLOWED_DIRS) {
    const full = path.join(PROJECT_ROOT, d)
    if (fs.existsSync(full)) walk(full, PROJECT_ROOT, files)
  }
  res.json({ success: true, files, readOnly: IS_READ_ONLY })
})

/**
 * 读取文件内容
 */
router.get('/file', requireAdmin, (req: Request, res: Response): void => {
  const relPath = String(req.query.path || '')
  if (!isPathSafe(relPath)) {
    res.status(400).json({ success: false, error: '无效或受限的文件路径' })
    return
  }
  const content = fs.readFileSync(path.resolve(PROJECT_ROOT, relPath), 'utf-8')
  res.json({ success: true, path: relPath, content, readOnly: IS_READ_ONLY })
})

/**
 * 保存文件内容（Vercel 部署时禁用）
 */
router.put('/file', requireAdmin, (req: Request, res: Response): void => {
  if (IS_READ_ONLY) {
    res.status(403).json({
      success: false,
      error: '云端部署模式下文件系统只读，无法保存。请在本地开发环境修改源码后提交。',
    })
    return
  }
  const { path: relPath, content } = req.body || {}
  if (!isPathSafe(relPath)) {
    res.status(400).json({ success: false, error: '无效或受限的文件路径' })
    return
  }
  if (typeof content !== 'string') {
    res.status(400).json({ success: false, error: '内容无效' })
    return
  }
  fs.writeFileSync(path.resolve(PROJECT_ROOT, relPath), content, 'utf-8')
  res.json({ success: true, path: relPath })
})

export default router
