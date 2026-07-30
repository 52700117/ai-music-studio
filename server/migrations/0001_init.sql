-- 初始化表结构 + 种子数据
-- 兼容 Turso (libSQL) 与本地 better-sqlite3

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

-- 种子：管理员账号 admin/admin123
INSERT OR IGNORE INTO admin (username, password_hash) VALUES ('admin', 'admin123');

-- 种子：默认激活状态
INSERT OR IGNORE INTO app_status (key, value) VALUES ('active', 'true');

-- 种子：演示广场歌曲
INSERT OR IGNORE INTO plaza_song (id, creation_id, title, author, cover_color, play_count, remix_count)
VALUES
  (1, NULL, '夏夜晚风', '阿橙', '#FF4D2E', 128, 5),
  (2, NULL, '城市独白', '小林', '#1F3A2E', 89, 2),
  (3, NULL, '雨后清晨', 'Maya', '#3B5BA5', 215, 12);
