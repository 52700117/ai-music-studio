/**
 * 数据库连接与初始化（libSQL 异步客户端）
 *
 * 双模式：
 * - 本地开发：TURSO_URL=file:./api/data/app.db（或不设置时默认本地文件）
 * - Vercel 生产：TURSO_URL=libsql://xxx.turso.io + TURSO_AUTH_TOKEN=xxx
 *
 * 兼容 better-sqlite3 风格的 SQL（? 占位符）
 */
import { createClient, type Client } from '@libsql/client'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * BASE_DIR：源码模式 / pkg 打包模式双兼容
 *   pkg 打包版：resources/ 目录在 exe 旁边，数据库 + 音频放 resources/data
 */
const IS_PKG = typeof (process as any).pkg !== 'undefined'
const IS_INSTALLER = !!process.env.MUSIC_APP_INSTALL_DIR
const EXEC_DIR = path.dirname(process.execPath)
const SOURCE_ROOT = path.resolve(__dirname, '..')
const BASE_DIR = IS_INSTALLER
  ? process.env.MUSIC_APP_INSTALL_DIR!
  : IS_PKG ? path.join(EXEC_DIR, 'resources') : SOURCE_ROOT

// Railway 持久化卷挂载在 /data；本地/打包版用 BASE_DIR/data
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? '/data'
  : path.join(BASE_DIR, 'data')
const LOCAL_DB_PATH = path.resolve(DATA_DIR, 'app.db')
// migrations 路径：pkg 打包版取 BASE_DIR/server/migrations；源码版取 __dirname/migrations
const MIGRATION_PATH = (IS_PKG || IS_INSTALLER)
  ? path.join(BASE_DIR, 'server', 'migrations', '0001_init.sql')
  : path.resolve(__dirname, 'migrations/0001_init.sql')

function resolveDbUrl(): string {
  if (process.env.TURSO_URL) return process.env.TURSO_URL
  // 本地开发：用 file: URL
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  return `file:${LOCAL_DB_PATH}`
}

export const db: Client = createClient({
  url: resolveDbUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const INLINE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  phone_encrypted TEXT,
  phone_masked TEXT,
  wechat_openid_encrypted TEXT,
  wechat_nickname TEXT,
  login_type TEXT NOT NULL DEFAULT 'phone',
  paused INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS creation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  prompt TEXT,
  voice TEXT,
  source_song_id INTEGER,
  audio_name TEXT,
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS plaza_song (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creation_id INTEGER,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_color TEXT NOT NULL DEFAULT '#FF4D2E',
  play_count INTEGER NOT NULL DEFAULT 0,
  remix_count INTEGER NOT NULL DEFAULT 0,
  shared_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (creation_id) REFERENCES creation(id)
);

CREATE TABLE IF NOT EXISTS suggestion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  content TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS app_status (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO admin (username, password_hash) VALUES ('admin', 'admin123');
INSERT OR IGNORE INTO app_status (key, value) VALUES ('active', 'true');
INSERT OR IGNORE INTO plaza_song (id, creation_id, title, author, cover_color, play_count, remix_count)
VALUES
  (1, NULL, '夏夜晚风', '阿橙', '#FF4D2E', 128, 5),
  (2, NULL, '城市独白', '小林', '#1F3A2E', 89, 2),
  (3, NULL, '雨后清晨', 'Maya', '#3B5BA5', 215, 12);
`

/**
 * 启动时执行迁移（幂等）
 * Vercel 环境用内联 SQL，本地开发优先读文件
 */
export async function runMigrations(): Promise<void> {
  let sql: string
  try {
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8')
  } catch {
    sql = INLINE_MIGRATION_SQL
  }
  await db.executeMultiple(sql)
}

/**
 * 在线升级：补字段（容错，列已存在则忽略）
 * libSQL 不支持 IF NOT EXISTS 加列，所以 try/catch
 */
async function ensureColumn(table: string, column: string, type: string): Promise<void> {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  } catch {
    /* 列已存在，忽略 */
  }
}

/**
 * 获取软件运行状态
 */
export async function getAppActive(): Promise<boolean> {
  const result = await db.execute({
    sql: 'SELECT value FROM app_status WHERE key = ?',
    args: ['active'],
  })
  const row = result.rows[0] as { value?: string } | undefined
  return row?.value === 'true'
}

/**
 * 设置软件运行状态
 */
export async function setAppActive(active: boolean): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO app_status (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: ['active', active ? 'true' : 'false'],
  })
}

/**
 * 初始化（异步，启动时调用一次）
 */
let initialized = false
export async function ensureInitialized(): Promise<void> {
  if (initialized) return
  initialized = true
  await runMigrations()
  await ensureColumn('user', 'paused', 'INTEGER DEFAULT 0')
  await ensureColumn('creation', 'audio_url', 'TEXT')
  // 用户名密码登录
  await ensureColumn('user', 'username', 'TEXT')
  await ensureColumn('user', 'password_hash', 'TEXT')
  await ensureColumn('user', 'password_updated_at', 'TEXT')
  try {
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON user(username) WHERE username IS NOT NULL`)
  } catch {
    /* index may already exist */
  }
}

// 本地开发：立即触发初始化（异步，不阻塞模块加载）
if (!process.env.TURSO_URL || process.env.TURSO_URL.startsWith('file:')) {
  ensureInitialized().catch((e) => console.error('[db] init failed:', e.message))
}
