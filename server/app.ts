/**
 * Express 应用入口
 * - 状态中间件：软件暂停时拦截普通 API（除 status 与 admin）
 * - 装配所有路由
 * - 静态资源服务：生产环境（Railway）提供前端构建产物
 */
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { getAppActive, ensureInitialized } from './db.js'
import authRoutes from './routes/auth.js'
import creationsRoutes from './routes/creations.js'
import plazaRoutes from './routes/plaza.js'
import suggestionsRoutes from './routes/suggestions.js'
import statusRoutes from './routes/status.js'
import adminRoutes from './routes/admin.js'
import codeRoutes from './routes/code.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * 软件状态中间件：暂停时拦截普通用户接口（异步）
 * 放行的接口：/api/status、/api/admin/*、/api/health
 */
app.use('/api', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  await ensureInitialized()
  const url = req.path
  const isExempt =
    url === '/status' ||
    url === '/health' ||
    url.startsWith('/admin')
  if (!isExempt) {
    const active = await getAppActive()
    if (!active) {
      res.status(503).json({ success: false, code: 'PAUSED', error: '软件维护中，暂不可用' })
      return
    }
  }
  next()
})

/**
 * 公开路由
 */
app.use('/api/status', statusRoutes)
app.use('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

/**
 * 静态音频文件服务
 * - 本地开发：项目内 public/audio
 * - Railway 生产：Railway Volume 挂载的 /data/audio（MusicGen 生成的音频存这里）
 */
app.use('/audio', express.static(path.resolve(__dirname, '../public/audio'), {
  maxAge: '7d',
}))
// Railway Volume 中的音频文件
const VOLUME_AUDIO_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'audio')
  : path.resolve(__dirname, 'data/audio')
if (fs.existsSync(VOLUME_AUDIO_DIR)) {
  app.use('/audio', express.static(VOLUME_AUDIO_DIR, {
    maxAge: '7d',
  }))
}

/**
 * 普通用户路由（鉴权在各 route 内）
 */
app.use('/api/auth', authRoutes)
app.use('/api/creations', creationsRoutes)
app.use('/api/plaza', plazaRoutes)
app.use('/api/suggestions', suggestionsRoutes)

/**
 * 管理员路由
 */
app.use('/api/admin', adminRoutes)
app.use('/api/admin/code', codeRoutes)

/**
 * 静态文件服务：生产环境（Railway）提供前端构建产物
 */
const DIST_DIR = path.resolve(__dirname, '../dist')
const IS_PROD = fs.existsSync(DIST_DIR)

if (IS_PROD) {
  app.use(express.static(DIST_DIR, { maxAge: '1y', index: false }))
}

/**
 * 错误处理
 */
app.use((error: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[server error]', error)
  res.status(500).json({ success: false, error: '服务器内部错误' })
})

/**
 * 404 - API 路由返回 JSON
 */
app.use('/api', (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, error: '接口不存在' })
})

/**
 * 前端路由回退：非 API 请求返回 index.html（SPA 路由）
 */
if (IS_PROD) {
  app.get('*', (_req: Request, res: Response): void => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
} else {
  app.use((_req: Request, res: Response): void => {
    res.status(404).json({ success: false, error: '接口不存在' })
  })
}

export default app
