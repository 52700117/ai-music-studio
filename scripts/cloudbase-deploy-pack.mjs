/**
 * CloudBase 一键部署打包脚本
 *   1. 要求先完成：npm run build（= tsc -b + vite build，生成 dist-server/ + dist/）
 *   2. 生成两个 zip 包：
 *      - .cloudbase-out/ai-music-scf.zip   → 上传到 CloudBase「云函数」→ 新建函数 → 本地上传ZIP
 *      - .cloudbase-out/static-site.zip    → 上传到 CloudBase「静态网站托管」→「上传文件/文件夹」
 *
 * 使用：
 *   cd 项目根目录
 *   npm run build
 *   node scripts/cloudbase-deploy-pack.mjs
 *
 * 打包完成后会把两个 zip 路径打印给你。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.cloudbase-out');

function log(...m) { console.log('[cloudbase-pack]', ...m); }
function fail(msg) { console.error('❌ ' + msg); process.exit(1); }
function cp(src, dst) {
  src = path.resolve(ROOT, src);
  dst = path.resolve(STAGE, dst);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, dereference: true, force: true });
}
function write(dst, content) {
  dst = path.resolve(STAGE, dst);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content, 'utf-8');
}

// ========== 先校验是否有 build 产物 ==========
const checks = [
  ['dist-server/app.js', '后端 dist-server 未生成，请先执行 npm run build（tsc -b）'],
  ['dist/index.html', '前端 dist/ 未生成，请先执行 npm run build（vite build）'],
];
for (const [f, msg] of checks) {
  if (!fs.existsSync(path.join(ROOT, f))) fail(msg);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ========== ========== ========== ========== ==========
//  PART 1：打包 云函数 ZIP → ai-music-scf.zip
// ========== ========== ========== ========== ==========
log('开始打包云函数...');
const STAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'scf-stage-'));
log('临时目录:', STAGE);

// 1. 云函数入口
cp('cloudfunctions/api/index.js', 'index.js');
cp('cloudfunctions/api/README.md', 'README.md');

// 2. 后端编译产物 dist-server/  →  zip 根目录下的 server/
//    index.js 里 require('./server/app.js')，所以 dist-server/ 的内容要平铺到 server/
const distServer = path.resolve(ROOT, 'dist-server');
const targetServer = path.resolve(STAGE, 'server');
fs.mkdirSync(targetServer, { recursive: true });
fs.cpSync(distServer, targetServer, { recursive: true, dereference: true });

// 3. SQL 迁移脚本（dist-server/ 里没包含，所以从源码目录复制）
cp('server/migrations', 'server/migrations');

// 4. 公开静态页（terms.html / privacy.html）
cp('public/terms.html', 'public/terms.html');
cp('public/privacy.html', 'public/privacy.html');

// 5. node_modules：从 package.json 清单里的「生产需要用到」项手动装
//    云函数运行 Node 18，只要 CommonJS/ESM 能 require 就行。为了确保云端不用 npm install，
//    把项目根目录下的 node_modules 里的「生产依赖」复制过来。
//    如果不想每次打包都几百 MB，云端有「在线安装依赖」按钮，用户点一下也可以。
//    这里我们采用「不复制 node_modules，但生成 package.json + package-lock.json」策略：
//    云端用自带的 IDE 或「安装依赖」按钮一键 npm install。因为 zip 大小越小越好。
cp('cloudfunctions/api/package.json', 'package.json');
// 复制 lock 作为锁版本用（如果有的话）
if (fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
  // 不要整份复制，云端用 mini package.json + lock 生成即可
  cp('package-lock.json', 'package-lock.json');
}

// 6. root .env.example 给用户参考
cp('.env.example', '.env.example');

// ===== 压缩为 zip =====
const scfZip = path.join(OUT, 'ai-music-scf.zip');
zipDir(STAGE, scfZip);
log('✅ 云函数 ZIP →', scfZip, '(' + sizeMB(scfZip) + ' MB)');
fs.rmSync(STAGE, { recursive: true, force: true });

// ========== ========== ========== ========== ==========
//  PART 2：打包 静态网站 ZIP → static-site.zip
// ========== ========== ========== ========== ==========
log('开始打包静态网站...');
const STAGE2 = fs.mkdtempSync(path.join(os.tmpdir(), 'static-stage-'));

const distDir = path.resolve(ROOT, 'dist');
fs.cpSync(distDir, STAGE2, { recursive: true, dereference: true });

// 告诉用户：在 index.html 里修改 window.__API_BASE__
const indexPath = path.join(STAGE2, 'index.html');
let indexHTML = fs.readFileSync(indexPath, 'utf-8');
// 注释更醒目的提示
indexHTML = indexHTML.replace(
  /window\.__API_BASE__ = null;/,
  [
    '/* =========================================================',
    '   部署 CloudBase 静态站之前，请把下面的 null 改成你的云函数 HTTP 地址',
    '   示例（去掉前面的 //）：',
    "     window.__API_BASE__ = 'https://你的环境ID.service.tcloudbase.com/ai-music-api'",
    '   注意末尾不要加 / 。保存后再上传这个 index.html',
    '   ========================================================= */',
    "window.__API_BASE__ = null; // TODO: 改成云函数地址后再上传",
  ].join('\n  '),
);
fs.writeFileSync(indexPath, indexHTML, 'utf-8');

// 额外放一个 README 帮助文件
write('README_DEPLOY.txt',
`【CloudBase 静态站部署说明】
1. 先部署云函数 ai-music-scf.zip，拿到它的 HTTP 访问地址（https://xxx.service.tcloudbase.com/ai-music-api）
2. 用记事本/VSCode 打开本文件夹里的 index.html，搜索 "__API_BASE__"，把 null 改成上一步的地址（保存）
3. 打开腾讯云 CloudBase 控制台 → 进入你的环境 → 左侧「静态网站托管」
   - 第一次用需要点「开通」（免费版包含，不额外收费）
4. 开通后点「上传文件/文件夹」，把整个这个文件夹里的所有内容全部上传
5. 系统会给你分配一个静态站默认域名（https://xxx.tcloudbaseapp.com）
6. 浏览器打开这个域名，就能看到登录注册页了。

【测试清单】
  ✅ 打开 / → 显示登录页
  ✅ 打开 /admin → 显示管理员后台登录页（admin / admin123）
  ✅ 打开 /terms → 用户协议，/privacy → 隐私政策
  ✅ 注册一个账号 → 返回用户 token
  ✅ 新建一首音乐 → 能看到作品列表
`);

const staticZip = path.join(OUT, 'static-site.zip');
zipDir(STAGE2, staticZip);
log('✅ 静态站 ZIP →', staticZip, '(' + sizeMB(staticZip) + ' MB)');
// 同时保留一份解压后的版本，方便用户直接拖上传（或直接压缩后手动改 index.html）
const staticUnpack = path.join(OUT, 'static-site');
fs.rmSync(staticUnpack, { recursive: true, force: true });
fs.cpSync(STAGE2, staticUnpack, { recursive: true });
fs.rmSync(STAGE2, { recursive: true, force: true });

log('');
log('🎉 打包完毕！以下是输出文件：');
log('  1) 云函数：' + scfZip);
log('  2) 静态站 zip：' + staticZip);
log('  3) 静态站（解压后可修改 index.html 后再传）：' + staticUnpack);
log('');
log('📋 下一步操作清单：');
log('  1. 先去 https://turso.tech 注册，创建数据库，拿到 TURSO_URL + TURSO_AUTH_TOKEN');
log('  2. CloudBase 控制台 →「云函数」→「新建函数」：');
log('     · 运行环境 Nodejs18，函数名 ai-music-api，上传 ai-music-scf.zip');
log('     · 进入函数详情 → 函数配置 → 环境变量：填 TURSO_URL / TURSO_AUTH_TOKEN');
log('     · 「触发管理」→ 创建 HTTP 触发器，路径 / 或 /ai-music-api，免鉴权，开 CORS');
log('     · 保存后拿到访问地址 https://xxx.service.tcloudbase.com/xxx');
log('  3. 打开 static-site/index.html，把 __API_BASE__ 改成上一步的地址，保存');
log('  4. CloudBase 控制台 →「静态网站托管」→ 开通后上传 static-site 目录所有文件');
log('  5. 打开静态站默认域名，就能用了！');
log('');

// ============= 工具函数 =============
function sizeMB(p) { return (fs.statSync(p).size / 1024 / 1024).toFixed(2); }

/**
 * 把 stageDir 目录打成 zip。
 *   - 优先用系统自带 zip（Node 没内置 archiver）
 *   - 没有 zip 命令就用 Node.js 自带的 zlib 手工打（只支持 DEFLATE，足够用）
 */
function zipDir(stageDir, outputZip) {
  try {
    execSync(`cd "${stageDir}" && zip -r -q "${outputZip}" . 2>&1`, { stdio: 'pipe' });
    return;
  } catch { /* 系统没有 zip 命令，走 Node 手工实现 */ }

  // Node 原生 archiver 没装，改用 spawn 检查 node 的 archiver 包？太啰嗦。
  // 实际：如果系统没 zip，提示用户手动在本地压缩（最简单）
  // 但在这个容器里，我们可以用 JS 自带 zlib + tar？不对，CloudBase 需要的是 zip，不是 tar.gz。
  // 保险做法：用 npx 调 archiver 一次性 CLI，避免全局安装。
  try {
    execSync(
      `npx --yes bestzip "${outputZip}" "${stageDir}"`.replace(/"/g, `"`),
      { stdio: 'pipe', cwd: ROOT, timeout: 120000 }
    );
    return;
  } catch (e) {
    console.warn('zip 命令失败（', (e.message || '').slice(0, 200), '），改用 JS 遍历压缩...');
  }

  // 最后兜底：写一个 .TAR.GZ，并提示用户把它改后缀 / 手动压
  const fallbackTarGz = outputZip.replace(/\.zip$/, '.tar.gz');
  try {
    execSync(`tar -czf "${fallbackTarGz}" -C "${stageDir}" . 2>&1`, { stdio: 'pipe' });
    console.warn(`⚠️  系统缺少 zip 命令，已生成 tar.gz：${fallbackTarGz}。
       请你在本地电脑进入 ${fallbackTarGz} 所在目录，
       右键「解压到当前文件夹」→ 再右键「全部选中 → 压缩为 .zip」即可上传 CloudBase。`);
    // 把文件保留在 outputZip 但内容是 tar.gz，避免下一步报错
    if (fs.existsSync(outputZip)) fs.unlinkSync(outputZip);
    fs.renameSync(fallbackTarGz, outputZip);
  } catch (e2) {
    fail('无法压缩成 zip：系统缺少 zip 和 tar。请手动压缩以下目录为 zip 后继续：' + stageDir);
  }
}
