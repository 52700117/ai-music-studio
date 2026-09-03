/**
 * CloudBase 云托管打包脚本
 *   1. 确认已经执行过 tsc -b（生成 dist-server）和 vite build（生成 dist）
 *   2. 把 node_modules(生产依赖) + dist + dist-server + public + package.json 复制到 .cloudbase/publish/
 *   3. 生成 cloudbase-xcbas.json 供后台上传识别启动
 *
 * 使用: npm run cloudbase-build （会先执行 npm ci + tsc -b + vite build，然后调用本脚本）
 * 或者本地先 npm run build，再 node scripts/cloudbase-pack.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.cloudbase', 'publish');

function log(...m) { console.log('[cloudbase-pack]', ...m); }
function cp(src, dst) {
  src = path.resolve(ROOT, src);
  dst = path.resolve(OUT, dst);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dst, { recursive: true, dereference: true, force: true });
}
function write(p, s) { fs.writeFileSync(path.resolve(OUT, p), s, 'utf-8'); }

// 清理输出目录
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
log('output dir:', OUT);

// === 检查产物是否存在 ===
const required = [
  ['dist/index.html', '前端 dist/ 没生成，请先执行 npm run build (vite build)'],
  ['dist-server/server.js', '后端 dist-server 没生成，请先执行 tsc -b'],
  ['server/migrations/0001_init.sql', '找不到 server/migrations'],
];
for (const [f, msg] of required) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.error('❌ 缺少产物: ' + f + ' -> ' + msg);
    process.exit(1);
  }
}

// === 复制项目 ===
cp('dist-server', 'dist-server');
cp('dist',        'dist');
cp('public',      'public');
cp('server/migrations', 'server/migrations');
cp('server/lib/migrations', 'server/lib/migrations');
cp('package.json', 'package.json');
cp('package-lock.json', 'package-lock.json');
cp('.env.example', '.env.example');
// 注意：不再复制 node_modules，让云托管 buildScript 执行 npm install 装依赖
// 这样上传包体积从 ~400MB 降到 ~5MB，上传速度大幅提升

// === 腾讯云云托管 Node.js 部署入口配置 ===
const xcbas = {
  recommendEntrypoint: 'node dist-server/server.js',
  baseImage: 'node:18',
  port: 80,
  // 在云托管的「构建阶段」执行 npm install（生产依赖），不用本地上传 node_modules
  buildScript: 'npm install --omit=dev --no-audit --no-fund',
};
write('cloudbase-xcbas.json', JSON.stringify(xcbas, null, 2));

write('README_CLOUDBASE.txt',
`=== 腾讯云 CloudBase 云托管部署说明 ===
1. 镜像来源：  选【Node.js】→ 版本 Node 18
2. 监听端口：  80
3. 启动命令：  node dist-server/server.js
4. 环境变量（控制台「环境配置」手动添加）：
     DATA_VOLUME_MOUNT_PATH=/data        (如果挂了数据卷 /data)
     MINIMAX_API_KEY=你的Key             （可选，开启AI音乐生成）
     SPUG_SMS_TEMPLATE_ID=模板ID         （可选，开启短信验证码）
5. 数据卷（推荐开启，否则重启后数据库会重置）：
     新建 1GB 卷，挂载到 /data
6. 完成后点「开始部署」，部署成功后到「服务设置→公网访问」开启公网访问
   系统会分配形如 https://xxx.service.tcloudbase.com 的域名
`);

log('✅ 打包完成 ->', OUT);
log('下一步：把这个目录的内容（或整个目录 zip 后）上传到云托管新建服务。');
