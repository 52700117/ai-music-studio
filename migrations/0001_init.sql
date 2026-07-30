-- 初始化数据库结构
-- 音乐创作软件 v1.0

CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  phone_encrypted TEXT,
  phone_masked TEXT,
  wechat_openid_encrypted TEXT,
  wechat_nickname TEXT,
  login_type TEXT NOT NULL CHECK(login_type IN ('wechat','phone')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS creation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('original','lyrics','pure','remix')),
  prompt TEXT,
  voice TEXT CHECK(voice IN ('male','female') OR voice IS NULL),
  source_song_id INTEGER,
  audio_name TEXT,
  status TEXT DEFAULT 'processing',
  progress INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS plaza_song (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creation_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_color TEXT NOT NULL,
  play_count INTEGER DEFAULT 0,
  remix_count INTEGER DEFAULT 0,
  shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(creation_id) REFERENCES creation(id)
);

CREATE TABLE IF NOT EXISTS suggestion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_status (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 初始管理员账号（演示用：admin / admin123）
INSERT OR IGNORE INTO admin (username, password_hash) VALUES ('admin', 'admin123');
INSERT OR IGNORE INTO app_status (key, value) VALUES ('active', 'true');

-- 演示广场歌曲种子数据
INSERT OR IGNORE INTO plaza_song (id, creation_id, title, author, cover_color, play_count, remix_count)
VALUES
  (1, 0, '夜色钢琴曲', '云汐', '#1F3A2E', 1284, 36),
  (2, 0, '晨光原创', '林深', '#FF4D2E', 968, 22),
  (3, 0, '星河纯音乐', 'Aria', '#3B5BA5', 2103, 58),
  (4, 0, '夏日民谣', '小满', '#E8A33D', 742, 14);
