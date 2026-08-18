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

/**
 * BASE_DIR：支持三种运行形态（源码 / Railway / pkg 打包后的单文件 exe）
 * 1) process.pkg 模式（pkg 打包成 exe 运行）：资源根目录 = exe 所在目录 / resources
 *    发布形态：music-app.exe 旁边带一个 resources/ 目录（放 dist、server、migrations）
 * 2) Railway / 本地源码：资源根目录 = 项目根（server/..）
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const IS_PKG = typeof (process as any).pkg !== 'undefined'
const EXEC_DIR = path.dirname(process.execPath)
const SOURCE_ROOT = path.resolve(__dirname, '..')
export const BASE_DIR = IS_PKG ? path.join(EXEC_DIR, 'resources') : SOURCE_ROOT

dotenv.config()
if (fs.existsSync(path.join(BASE_DIR, '.env'))) {
  dotenv.config({ path: path.join(BASE_DIR, '.env') })
}

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
 * - 本地开发 / 源码运行：项目内 public/audio
 * - Railway 生产：Railway Volume 挂载的 /data/audio（MusicGen 生成的音频存这里）
 * - pkg 打包版：BASE_DIR/data/audio（exe 同级 resources/data/audio）
 */
const PUBLIC_AUDIO_DIR = IS_PKG
  ? path.join(BASE_DIR, 'public', 'audio')
  : path.resolve(__dirname, '../public/audio')
app.use('/audio', express.static(PUBLIC_AUDIO_DIR, { maxAge: '7d' }))
const VOLUME_AUDIO_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'audio')
  : IS_PKG
  ? path.join(BASE_DIR, 'data', 'audio')
  : path.resolve(__dirname, 'data/audio')
if (fs.existsSync(VOLUME_AUDIO_DIR)) {
  app.use('/audio', express.static(VOLUME_AUDIO_DIR, { maxAge: '7d' }))
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
 * 静态文件服务：有 dist 目录就提供前端构建产物
 *   - Railway / 源码：../dist
 *   - pkg 打包版：BASE_DIR/dist
 */
const DIST_DIR = path.join(BASE_DIR, 'dist')
const IS_PROD = fs.existsSync(DIST_DIR) && fs.existsSync(path.join(DIST_DIR, 'index.html'))

if (IS_PROD) {
  app.use(express.static(DIST_DIR, { maxAge: '1y', index: false }))
}

/**
 * 下载文件服务：/dl 路径暴露 release/ 目录，直链下载 Win/Mac 安装包
 * 支持三种运行形态，release 目录不存在时也不会报错（开发环境可以临时没包）
 */
const RELEASE_DIR = IS_PKG
  ? path.join(EXEC_DIR, 'release')        // pkg 打包版：exe 同级 release/
  : path.resolve(__dirname, '../release') // 源码/Railway：项目根 release/
if (fs.existsSync(RELEASE_DIR)) {
  app.use('/dl', express.static(RELEASE_DIR, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      // zip 包强制下载（而不是在浏览器里打开）
      if (filePath.toLowerCase().endsWith('.zip')) {
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`)
      }
    },
  }))
} else {
  // 即使目录不存在，/dl 请求也返回友好 JSON 提示（避免被 SPA fallback 兜成首页）
  app.use('/dl', (_req: Request, res: Response): void => {
    res.status(404).json({
      success: false,
      error: '暂无安装包，请先运行打包脚本生成 release 目录。',
    })
  })
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
