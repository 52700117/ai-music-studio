# CloudBase 云函数部署包 —— AI 音乐创作 API

## 说明
本目录是给腾讯云「云开发 CloudBase · 云函数」上传用的。
云函数运行时要求：Nodejs18 及以上，入口文件 `index.js`，handler 为 `index.main`（腾讯云默认）。

## 内容
- `index.js`：云函数入口，用 serverless-http 把 Express app 包装成 SCF handler
- `server/`：编译后的后端 JS 文件（从项目 `dist-server/` 复制）
- `public/`：用户协议、隐私政策静态页面
- `server/migrations/0001_init.sql`：首次建表脚本
- `node_modules/`：生产依赖（云端环境变量里要配置的密钥不用打包进来）

## 需要在 CloudBase 云函数「环境变量」里配置的密钥
| 环境变量名 | 说明 | 是否必须 |
|------------|------|---------|
| TURSO_URL | Turso 数据库 URL，如 `libsql://xxx.turso.io` | ✅ 必须（否则函数启动后无法连接远程数据库） |
| TURSO_AUTH_TOKEN | Turso 数据库 Auth Token | ✅ 必须 |
| MINIMAX_API_KEY | MiniMax AI 音乐生成密钥 | ❌ 可选，没配置就用浏览器本地合成器人声 |
| SPUG_SMS_TEMPLATE_ID | Spug 推送短信模板 ID | ❌ 可选，没配置短信验证码固定为 `123456` |
| ADMIN_PASSWORD | 后台管理员默认密码（没有就用 admin123）| ❌ 可选 |
| JWT_SECRET | 签名密钥，建议自己填一段随机字母数字（≥16位）| ❌ 可选，不填就用默认值（推荐填） |

## 部署步骤
1. 先跑项目根目录的 `node scripts/cloudbase-pack.mjs`，自动会生成 `.cloudbase-out/ai-music-scf.zip`
2. 打开腾讯云 CloudBase 控制台 → 进入环境 → 左侧「云函数」→「新建云函数」
   - 函数名称：`ai-music-api`
   - 运行环境：Nodejs18.x（或更高）
   - 创建方式：**本地上传 ZIP 包**
   - 函数入口：`index.main`（就是 index.js 里 export.main）
3. 上传 `.cloudbase-out/ai-music-scf.zip`
4. 函数创建完 → 函数详情页 →「函数配置」→「环境变量」→ 把上面那张表里的密钥全部填进去 →「保存」
5. 函数详情页 →「触发管理」→「创建触发器」：
   - 触发方式：**HTTP 访问服务**（API 网关 / HTTP 触发器）
   - 路径：`/api`
   - 开启 CORS：打勾
   - 身份鉴权：**「免鉴权」**（我们业务接口内部有 JWT + admin 鉴权）
6. 保存后会给你分配一个 HTTP 访问地址，类似：
   `https://<envId>.service.tcloudbase.com/ai-music-api`
   这个就是你的 API_BASE_URL，部署静态站时要填到 index.html 的 window.__API_BASE__ 里
