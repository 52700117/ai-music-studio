# 音乐创作软件

基于 React + Vite + Express 的 AI 音乐创作应用，支持灵感模式、自定义歌词、纯音乐、改编四种创作模式，集成 Suno（ACE Data Cloud）API 生成真实可演唱的音乐。

## 部署架构

| 层 | 本地开发 | Vercel 生产 |
| --- | --- | --- |
| 前端 | Vite dev server (5173) | 静态资源 CDN |
| 后端 | Express (3001) | Serverless Functions (`api/index.ts`) |
| 数据库 | 本地 SQLite (`api/data/app.db`) | Turso (libSQL 云数据库) |
| 音频 | 本地文件 `public/audio/` | 直接存储 Suno 返回的 CDN URL |

> **为什么用 Vercel？** Serverless 函数自动伸缩、永远在线，不再需要本地后端常驻，彻底解决"软件用一段时间服务器就要重启"的问题。

## 一、准备 Turso 云数据库

Turso 是基于 libSQL 的边缘云数据库，免费额度足够个人项目使用。

1. 注册账号：<https://turso.tech/app>（支持 GitHub 登录）
2. 安装 CLI（可选，也可在网页操作）：
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```
3. 创建数据库：
   ```bash
   turso db create music-app
   ```
4. 获取连接 URL：
   ```bash
   turso db show music-app --url
   # 输出：libsql://music-app-<your-name>.turso.io
   ```
5. 生成访问 Token：
   ```bash
   turso db tokens create music-app
   # 输出一长串 eyJ... 字符串
   ```
6. 初始化表结构（首次部署可跳过，应用启动时会自动执行 [migrations/0001_init.sql](migrations/0001_init.sql)）；如需手动导入：
   ```bash
   turso db shell music-app < migrations/0001_init.sql
   ```

## 二、配置环境变量

### 本地开发

复制 `.env.example`（或直接编辑 `.env`）：

```bash
# ACE Data Cloud - Suno 音乐生成 API Token
# 注册：https://platform.acedata.cloud
# 获取：登录后进入 Suno Audios 服务页 → Acquire Token
ACEDATA_API_TOKEN=your_acedata_token_here

# Turso 云数据库（留空则使用本地 SQLite：api/data/app.db）
TURSO_URL=libsql://music-app-xxx.turso.io
TURSO_AUTH_TOKEN=eyJxxxxxxxxxxxx

# JWT 签名密钥（可选，默认值已硬编码）
TOKEN_SECRET=music-app-token-secret-2026
```

### Vercel 部署

在 Vercel 项目设置 → Environment Variables 中添加以下三个：

| Name | Value | 说明 |
| --- | --- | --- |
| `ACEDATA_API_TOKEN` | `d2c883b8...` | Suno API Token |
| `TURSO_URL` | `libsql://music-app-xxx.turso.io` | Turso 数据库 URL |
| `TURSO_AUTH_TOKEN` | `eyJxxxxxxxxxxxx` | Turso 访问 Token |

> 不要在 Vercel 上配置 `TURSO_URL=file:...`，文件系统在 Serverless 中是只读的。

## 三、部署到 Vercel

### 方式 A：CLI 部署（推荐）

1. 安装 Vercel CLI：
   ```bash
   npm i -g vercel
   vercel login
   ```
2. 在项目根目录执行：
   ```bash
   vercel        # 首次部署（预览环境）
   vercel --prod # 部署到生产环境
   ```
3. 在 Vercel Dashboard 配置环境变量（见上节），然后重新部署一次使其生效：
   ```bash
   vercel --prod
   ```

### 方式 B：Git 集成（GitHub 自动部署）

1. 将项目推送到 GitHub 仓库
2. 进入 <https://vercel.com/new> → Import 仓库
3. Framework Preset 自动识别为 **Vite**
4. 在部署前配置环境变量（见上节）
5. 点击 Deploy

部署成功后会得到一个 `https://<project>.vercel.app` 的永久在线地址。

## 四、本地开发

```bash
# 安装依赖
pnpm install

# 同时启动前端 (5173) + 后端 (3001)
pnpm dev

# 或单独启动
pnpm client:dev   # 前端
pnpm server:dev   # 后端（nodemon 热重载）

# 类型检查
pnpm check

# 生产构建
pnpm build
```

前端访问：<http://localhost:5173>
后端 API：<http://localhost:3001/api/health>

## 五、关键文件说明

| 路径 | 作用 |
| --- | --- |
| [api/index.ts](api/index.ts) | Vercel Serverless 入口，转发请求到 Express app |
| [api/app.ts](api/app.ts) | Express 应用，装配路由与中间件 |
| [api/db.ts](api/db.ts) | libSQL 数据库连接（双模式：本地 file / 云 Turso） |
| [api/lib/stableAudio.ts](api/lib/stableAudio.ts) | Suno API 封装：提交任务 → 轮询 → 返回音频 URL |
| [api/lib/auth.ts](api/lib/auth.ts) | 异步鉴权中间件（requireUser / requireAdmin） |
| [api/routes/creations.ts](api/routes/creations.ts) | 创作核心逻辑，音频 URL 直接入库 |
| [api/routes/code.ts](api/routes/code.ts) | 代码编辑路由，Vercel 部署时只读 |
| [vercel.json](vercel.json) | Vercel 部署配置：构建命令、函数超时、路由重写 |
| [migrations/0001_init.sql](migrations/0001_init.sql) | 数据库初始化 SQL |

## 六、Vercel 部署注意事项

1. **文件系统只读**：Serverless 函数无法写入磁盘。本项目的应对：
   - 数据库改用 Turso（云）
   - 音频不再下载到本地，直接保存 Suno 返回的 CDN URL
   - 代码在线编辑接口（`PUT /api/admin/code/file`）自动返回只读提示

2. **函数超时**：`vercel.json` 中已配置 `maxDuration: 60`（秒）。Suno 音乐生成通常需 30–90 秒，如遇超时可：
   - 升级 Vercel Pro 提升到 300 秒上限
   - 或改为异步任务模式（前端轮询 `/api/creations/:id/status`）

3. **冷启动**：Serverless 闲置后会冷启动，首次请求约 1–2 秒延迟，属正常现象。

4. **数据库初始化**：`ensureInitialized()` 在首次 API 请求时自动执行迁移，无需手动操作。

## 七、默认管理员账号

| 用户名 | 密码 |
| --- | --- |
| `admin` | `admin123` |

> 生产环境务必通过 `/api/admin` 接口修改默认密码。

## 八、技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + React Router 7
- **后端**：Express 4 + TypeScript + tsx
- **数据库**：libSQL（本地 SQLite / Turso 云）
- **音乐生成**：Suno chirp-v3-5（经 ACE Data Cloud）
- **部署**：Vercel（Serverless Functions + 静态托管）
