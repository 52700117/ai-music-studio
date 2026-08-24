/**
 * NSIS 安装版启动入口（ESM 格式，配合 esbuild 打包的 server.mjs）
 *
 * 安装后目录结构：
 *   C:\Users\xxx\AppData\Local\MusicApp\
 *     node.exe              ← 便携版 Node.js
 *     start-installer.mjs   ← 本文件（由 launcher.vbs 调用）
 *     server.mjs            ← esbuild 打包的服务端
 *     dist/                 ← 前端构建产物
 *     server/migrations/    ← 数据库迁移 SQL
 *     data/                 ← SQLite 数据库 + 音频文件（运行时自动创建）
 *     node_modules/@libsql/ ← Windows 原生二进制
 *     app.hta               ← 原生窗口（由 launcher.vbs 打开）
 *     launcher.vbs          ← 启动器（后台运行本文件，无黑窗口）
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置安装目录为 BASE_DIR，让 server.mjs 能找到 dist/、data/ 等
process.env.MUSIC_APP_INSTALL_DIR = __dirname;

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 启动服务（server.mjs 会监听端口并写入 port.txt）
try {
  await import('./server.mjs');
} catch (err) {
  console.error('启动失败:', err.message);
  console.error(err.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

// 服务已启动，launcher.vbs 会检测 port.txt 并打开 app.hta
