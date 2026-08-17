-- 0002_add_username_password.sql
-- 为用户表添加用户名和密码字段，支持真实账号密码登录

-- SQLite 不支持 IF NOT EXISTS 加列，这里用幂等语句
-- 实际执行时由后端 ensureColumn 容错处理
ALTER TABLE user ADD COLUMN username TEXT;
ALTER TABLE user ADD COLUMN password_hash TEXT;
ALTER TABLE user ADD COLUMN password_updated_at TEXT;

-- 为 username 创建唯一索引（允许 NULL，老用户不受影响）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON user(username) WHERE username IS NOT NULL;
