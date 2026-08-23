/**
 * NSIS 安装版启动入口（ESM 格式，配合 esbuild 打包的 server.mjs）
 *
 * 安装后目录结构：
 *   C:\Users\xxx\AppData\Local\MusicApp\
 *     node.exe              ← 便携版 Node.js
 *     start-installer.mjs   ← 本文件（NSIS 桌面快捷方式指向这里）
 *     server.mjs            ← esbuild 打包的服务端
 *     dist/                 ← 前端构建产物
 *     server/migrations/    ← 数据库迁移 SQL
 *     data/                 ← SQLite 数据库 + 音频文件（运行时自动创建）
 *     node_modules/@libsql/ ← Windows 原生二进制
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置安装目录为 BASE_DIR，让 server.mjs 能找到 dist/、data/ 等
process.env.MUSIC_APP_INSTALL_DIR = __dirname;

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 启动服务
try {
  await import('./server.mjs');
} catch (err) {
  console.error('[启动失败]', err);
  // Windows 下保持窗口不关闭，方便看错误
  if (process.platform === 'win32') {
    console.error('\n按 Ctrl+C 关闭此窗口');
  }
  process.exit(1);
}

// 3 秒后自动打开浏览器
setTimeout(() => {
  const url = `http://localhost:${process.env.PORT || 3001}`;
  console.log(`\n🌐 正在打开浏览器: ${url}`);
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', url], { detached: true, stdio: 'ignore' }).unref();
  }
}, 3000);
