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
const IS_INSTALLER = !!process.env.MUSIC_APP_INSTALL_DIR
const EXEC_DIR = path.dirname(process.execPath)
const SOURCE_ROOT = path.resolve(__dirname, '..')
export const BASE_DIR = IS_INSTALLER
  ? process.env.MUSIC_APP_INSTALL_DIR!
  : IS_PKG ? path.join(EXEC_DIR, 'resources') : SOURCE_ROOT

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
    url === '/version' ||
    url === '/dl-debug' ||
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
 * 版本检查接口（给前端自动更新机制用）
 * - 优先返回 dist/version.json 中的构建版本（Vite closeBundle 写入）
 * - 没有 version.json 时，回退为 dist/index.html 的修改时间（开发/老包兼容）
 * - 响应头强制禁用浏览器缓存，避免 QQ 浏览器/夸克 等激进缓存导致拿不到最新版本
 */
app.get('/api/version', (_req: Request, res: Response): void => {
  // 强制禁用所有缓存
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')

  try {
    const versionJsonPath = path.join(DIST_DIR, 'version.json')
    if (fs.existsSync(versionJsonPath)) {
      const raw = fs.readFileSync(versionJsonPath, 'utf-8')
      const parsed = JSON.parse(raw)
      res.status(200).json({
        success: true,
        version: parsed.version,
        builtAt: parsed.builtAt || null,
        source: 'version.json',
      })
      return
    }

    // 回退：使用 index.html 的 mtime 作为版本号（秒级时间戳，避免毫秒漂移）
    const indexPath = path.join(DIST_DIR, 'index.html')
    if (fs.existsSync(indexPath)) {
      const stat = fs.statSync(indexPath)
      const fallbackVersion = String(Math.floor(stat.mtimeMs / 1000))
      res.status(200).json({
        success: true,
        version: fallbackVersion,
        builtAt: stat.mtime.toISOString(),
        source: 'index.html-mtime',
      })
      return
    }

    // 开发环境（没有 dist）也返回一个稳定占位，避免前端报错
    res.status(200).json({
      success: true,
      version: 'dev',
      builtAt: new Date().toISOString(),
      source: 'dev-placeholder',
    })
  } catch (err) {
    console.error('[api/version] error:', err)
    res.status(500).json({ success: false, error: '读取版本信息失败' })
  }
})

/**
 * 静态音频文件服务
 * - 本地开发 / 源码运行：项目内 public/audio
 * - Railway 生产：Railway Volume 挂载的 /data/audio（MusicGen 生成的音频存这里）
 * - pkg 打包版：BASE_DIR/data/audio（exe 同级 resources/data/audio）
 */
const PUBLIC_AUDIO_DIR = (IS_PKG || IS_INSTALLER)
  ? path.join(BASE_DIR, 'public', 'audio')
  : path.resolve(__dirname, '../public/audio')
app.use('/audio', express.static(PUBLIC_AUDIO_DIR, { maxAge: '7d' }))
const VOLUME_AUDIO_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'audio')
  : (IS_PKG || IS_INSTALLER)
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
const RELEASE_DIR = (IS_PKG || IS_INSTALLER)
  ? path.join(BASE_DIR, 'release')
  : path.resolve(__dirname, '../release')

// 调试接口：查看 release 目录内容
app.get('/api/dl-debug', (_req: Request, res: Response): void => {
  const exists = fs.existsSync(RELEASE_DIR)
  const files = exists ? fs.readdirSync(RELEASE_DIR).map(f => {
    const stat = fs.statSync(path.join(RELEASE_DIR, f))
    return { name: f, size: stat.size, isFile: stat.isFile() }
  }) : []
  res.json({
    releaseDir: RELEASE_DIR,
    exists,
    cwd: process.cwd(),
    dirname: __dirname,
    files,
  })
})

if (fs.existsSync(RELEASE_DIR)) {
  app.use('/dl', express.static(RELEASE_DIR, {
    maxAge: '1d',
    acceptRanges: true,
    lastModified: true,
    fallthrough: true, // 关键：static 找不到时把控制权交给后续中间件，而不是直接 next('route')
    setHeaders: (res, filePath) => {
      const low = filePath.toLowerCase()
      // 对下载文件统一禁用 CDN/边缘的压缩改写和内容变换（Railway Hikari 可能自动压缩）
      res.setHeader('Cache-Control', 'public, max-age=86400, no-transform')
      res.setHeader('Vary', 'Accept-Encoding')

      // zip 包强制下载（而不是在浏览器里打开）
      if (low.endsWith('.zip')) {
        const filename = path.basename(filePath)
        // RFC 5987 兼容中文文件名（Chrome/QB/夸克 等不会因编码异常截断下载）
        const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_')
        const utf8Encoded = encodeURIComponent(filename)
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`,
        )
        // 显式声明可预期的长度，避免代理/边缘节点在大文件 chunked 时提前断流
        try {
          const stat = fs.statSync(filePath)
          if (stat.isFile()) res.setHeader('Content-Length', String(stat.size))
        } catch {
          /* ignore */
        }
      }
      // md5 校验文件也作为纯文本下载
      if (low.endsWith('.md5')) {
        const filename = path.basename(filePath)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      }
    },
  }))
}

/**
 * /dl/* 兜底：文件不存在或 release 目录不存在时的错误处理
 * 必须写在 express.static 之后、SPA fallback 之前。
 *
 * 智能判断客户端类型：
 *   - 如果是浏览器直接下载 <a download> / 地址栏直链（Accept 包含 text/html 或无 X-Requested-With）：
 *     302 跳回 /download，并在 query 里带错误信息，这样前端可以显示友好提示，浏览器
 *     不会把 404/错误 JSON 作为 zip 保存（否则 Chrome 会显示"无法从网站上提取文件"）。
 *   - 其他（fetch/XHR/curl/API 调用）：返回 JSON 404，便于前端自行判断。
 */
app.use('/dl', (req: Request, res: Response): void => {
  const accept = String(req.headers.accept || '')
  const xrw = String(req.headers['x-requested-with'] || '')
  const filename = path.basename(req.path || '') || '安装包'
  const viaBrowser = /html|xhtml/i.test(accept) || (xrw === '' && req.method === 'GET')
  const file = encodeURIComponent(filename)
  if (viaBrowser) {
    res.redirect(302, `/download?dl_error=not_found&dl_file=${file}`)
    return
  }
  res.status(404).json({
    success: false,
    error: '该安装包暂时未上传，请稍后重试或选择源码一键版。',
    file: filename,
  })
})

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
