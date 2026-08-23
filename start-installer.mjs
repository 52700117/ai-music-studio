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

console.log('='.repeat(50));
console.log('  音乐创作软件正在启动...');
console.log('  安装目录:', __dirname);
console.log('='.repeat(50));
console.log('');

// 启动服务
try {
  await import('./server.mjs');
} catch (err) {
  console.error('');
  console.error('='.repeat(50));
  console.error('  [启动失败]', err.message);
  console.error('  ', err.stack?.split('\n').slice(0, 3).join('\n  '));
  console.error('='.repeat(50));
  console.error('');
  console.error('  请截图此窗口发给开发者，然后按任意键关闭。');
  // Windows 下保持窗口不关闭，方便看错误
  if (process.platform === 'win32') {
    process.stdin.resume();
  }
  process.exit(1);
}

// 3 秒后自动打开浏览器
setTimeout(() => {
  const url = `http://localhost:${process.env.PORT || 3001}`;
  console.log(`\n  浏览器正在打开: ${url}`);
  console.log('  如果没有自动打开，请手动复制上面的网址到浏览器。\n');
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', url], { detached: true, stdio: 'ignore' }).unref();
  }
}, 3000);
