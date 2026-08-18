/**
 * pkg 打包版启动入口（必须是 CommonJS 风格的单文件入口，放在项目根）
 *  1) 先把 resources/ 目录定位成 BASE_DIR（在 app.ts / db.ts 里已经有 process.pkg 判断）
 *  2) 因为源码是 TypeScript + ESM，这里用 tsx 来启动（pkg 会把 tsx 和 node_modules 打进去）
 *
 * 发布形态：
 *   music-app.exe          ← 双击就启动（本文件打包成的可执行文件）
 *   resources/
 *     dist/                ← 前端构建产物（Vite 输出的 index.html / assets）
 *     server/              ← server.ts / db.ts / routes / migrations
 *     data/                ← 数据库（app.db）和音频（打包版首次运行会自动创建）
 *     public/audio/        ← 静态音频资源
 *     node_modules/        ← 所有运行时依赖（pkg 会帮我们打）
 *     package.json
 */
const path = require('path');
const fs = require('fs');

// 兼容 Node ESM loader：强制 import tsx 然后启动 server/server.ts
async function bootstrap() {
  // 给资源目录定位：exe 同级 resources/
  const exeDir = path.dirname(process.execPath);
  const resources = path.join(exeDir, 'resources');
  if (!fs.existsSync(resources)) {
    console.error('[错误] 找不到 resources 目录，请确保 music-app.exe 与 resources/ 文件夹放在同一目录。');
    process.exit(1);
  }
  process.chdir(resources);
  const { register } = await import('tsx');
  const unregister = register();
  await import(path.join(resources, 'server', 'server.ts'));
}
bootstrap().catch((e) => {
  console.error('[启动失败]', e);
  process.exit(1);
});
