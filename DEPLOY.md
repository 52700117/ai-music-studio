# 🚀 音乐软件部署指南

本项目是一个全栈音乐创作应用：**Node.js (Express) + SQLite + React (Vite)**。
下面提供三种最简单的部署方案，任选一种即可。

---

## 📋 部署前准备

### 1. 把项目代码上传到 GitHub

先把 `/workspace` 里的所有文件推到你自己的 GitHub 仓库（推荐 private）。

```bash
# 在 /workspace 目录执行（Trae IDE 终端或本地终端）
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 2. 准备好 MiniMax API Key（可选但推荐）

没有它就只能用前端合成器生成单调的旋律。

1. 打开 https://platform.minimaxi.com 用手机号注册
2. 进入「控制台」→「API 密钥」→ 创建新密钥
3. 复制 `xxxxxxxxxx` 备用
4. 官方免费模型：`music-3.0-free`（每分钟 3 次，0 元）

---

## 🎯 方案一：Railway（推荐 ⭐⭐⭐）

**最适合本项目**：Railway 原生支持 Node.js、有持久化 Volume（存数据库）、一键部署、自动 HTTPS。

### 步骤 1：创建项目

1. 打开 https://railway.app 用 GitHub 登录
2. 点「New Project」→「Deploy from GitHub repo」
3. 选择你刚才上传的仓库，选 `main` 分支
4. 勾选「Add variables after build」→ 点「Deploy」等待构建完成

### 步骤 2：添加持久化 Volume（存数据库）

**⚠️ 不做这步每次重启数据会清零！**

1. 在项目页点「+ New」→「Volume」
2. 挂载路径填：`/data`
3. 大小：至少 1GB（免费额度内）
4. 点「Add Volume」后会自动触发重新部署

### 步骤 3：配置环境变量

进入项目 →「Variables」→ 点「Add Variable」，逐个添加：

| Key | Value | 必填 |
|-----|-------|------|
| `PORT` | `3001` | ✅ |
| `RAILWAY_VOLUME_MOUNT_PATH` | `/data` | ✅（有 Volume 才加）|
| `MINIMAX_API_KEY` | 你的 MiniMax API Key | ⭐ 强烈推荐 |
| `TOKEN_SECRET` | 随便写一串长字符串（例如 `my-super-secret-key-2026`）| ✅ |
| `ACEDATA_API_TOKEN` | 可选，Suno 音乐生成（收费）| ❌ |

加完后服务会自动重启。

### 步骤 4：绑定域名

1. 项目页 →「Settings」→「Networking」
2. 点「Generate Domain」会自动给你一个 `xxx.up.railway.app` 的域名
3. 或者绑定你自己的域名（需要添加 DNS 记录）
4. 部署完成后访问：
   - 前端：`https://你的域名/`
   - 管理后台：`https://你的域名/admin`（默认账号 admin / admin123）

> Railway 有每月 5 美元免费额度，个人用足够。

---

## 🎯 方案二：Render（免费额度更大）

Render 免费版可以跑，但免费版 15 分钟无访问会休眠（类似 Trae IDE）。
**如果你在意 7×24 不中断，选付费版或 Railway。**

### 步骤

1. 打开 https://render.com 用 GitHub 登录
2. 点「New +」→「Web Service」
3. 选你的 GitHub 仓库
4. 配置如下：
   - **Name**：随便起（例：my-music-app）
   - **Region**：Singapore（离国内最近）
   - **Branch**：main
   - **Runtime**：Node
   - **Build Command**：`npm install && npm run build`
   - **Start Command**：`npm start`
   - **Instance Type**：
     - 免费：选 Free（会休眠，适合测试）
     - 付费：选 Starter（10 美元/月，不休眠）
5. 点「Advanced」→「Add Environment Variables」：

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `MINIMAX_API_KEY` | 你的 MiniMax API Key |
| `TOKEN_SECRET` | 随便写一串长字符串 |

6. 点「Create Web Service」等待部署（大约 3-5 分钟）

### 关于 Render 的数据库

Render 的免费版**没有持久化磁盘**，重启后 SQLite 数据会丢失。
解决方案：

**方案 A**：用 Turso（免费 SQLite 云服务）
- 注册 https://turso.tech 创建免费数据库
- 拿到 `TURSO_URL`（libsql://xxx.turso.io）和 `TURSO_AUTH_TOKEN`
- 在 Render 环境变量中添加这两个 Key
- 本项目的 `db.ts` 已原生支持 Turso

**方案 B**：升级到 Render Starter 付费版并挂载 Disk（每月 +1 美元）

---

## 🎯 方案三：Vercel（纯 Serverless）

Vercel 是 Serverless 架构，本项目已经内置了 `vercel.json` 和前端构建配置。
**缺点**：Serverless 函数有执行时长限制（最高 60 秒），而 MiniMax 生成一首歌需要 30-90 秒，可能会超时。
**适合**：主要使用本地合成器，或音乐生成需求不频繁的场景。

### 步骤

1. 打开 https://vercel.com 用 GitHub 登录
2. 点「Add New...」→「Project」
3. 选你的仓库 → 点「Import」
4. Framework Preset 自动识别为 Vite，不用改
5. 点「Environment Variables」添加：

| Key | Value |
|-----|-------|
| `MINIMAX_API_KEY` | 你的 MiniMax API Key |
| `TOKEN_SECRET` | 随便写一串长字符串 |

6. 数据库用 Turso（同上 Render 的方案 A），再加：

| Key | Value |
|-----|-------|
| `TURSO_URL` | libsql://xxx.turso.io |
| `TURSO_AUTH_TOKEN` | xxx |

7. 点「Deploy」等待完成
8. 部署后访问：
   - 前端：`https://项目名.vercel.app/`
   - 管理后台：`https://项目名.vercel.app/admin`

> Vercel 完全免费，国内访问速度较快，但音乐生成可能因为函数超时失败。

---

## 🔧 部署后必做检查

### 1. 健康检查

访问 `https://你的域名/api/health`，应该返回：
```json
{"success":true,"message":"ok"}
```

### 2. 登录管理后台

访问 `https://你的域名/admin`，用默认账号登录：
- 账号：`admin`
- 密码：`admin123`

**⚠️ 登录后立刻修改默认密码！**（管理后台 → 修改管理员密码）

### 3. 测试音乐生成

1. 访问首页 `https://你的域名/`
2. 注册一个普通用户账号
3. 选「原创音乐」→ 填创作要求 → 点「开始创作」
4. 如果配置了 MiniMax API Key，会调用 AI 生成真实歌曲
5. 如果没有配置，会使用前端合成器生成旋律（本地振荡器）

### 4. 验证 MiniMax 是否启用

打开浏览器 F12 → Console → Network，等生成完成后查看 `/api/creations/:id` 返回的 `audioUrl`：
- 有 `minimaxi.com` 开头的 URL → ✅ MiniMax 已生效
- 是 `null` → ⚠️ 没配置 API Key，在降级模式

---

## 📝 常见问题

### Q: 部署后能打开首页，但注册/登录失败？

**A**：看服务日志（Railway/Render 都在项目页有 Logs 面板），通常是：
- SQLite 文件路径问题 → 检查 Volume / TURSO 配置
- TOKEN_SECRET 不一致 → 确保所有实例用同一个

### Q: 生成音乐一直卡在 100% 没音频？

**A**：
1. 检查 `MINIMAX_API_KEY` 是否正确配置
2. 打开服务日志看有没有 `[minimax] 生成失败` 的错误
3. 可能是 RPM 限制（免费版每分钟 3 次）→ 等 1 分钟再试

### Q: 管理后台登录不上？

**A**：首次启动会自动创建 admin 账号（密码 admin123）。
如果数据库迁移失败，会没账号。解决：把 Volume/Turso 清空重新部署。

### Q: 换了端口/域名后管理后台打不开？

**A**：管理后台路径永远是 `/admin`，比如：
- http://localhost:3001/admin ✅
- https://xxx.up.railway.app/admin ✅

### Q: 能把项目打包成本地桌面 App 吗？

**A**：可以。用 Electron 或 Tauri 包装一下 Node.js 后端 + Vite 前端即可。
建议先在 Railway/Render 上线一个在线版本用。

---

## 🎁 三种方案对比

| | Railway ⭐推荐 | Render 免费 | Render 付费 | Vercel |
|---|---|---|---|---|
| **价格** | 5 美元/月起（有免费额度） | 0 美元 | 11 美元/月起 | 0 美元 |
| **是否休眠** | 不休眠 | 15 分钟闲置休眠 | 不休眠 | 不休眠 |
| **持久化存储** | 有（Volume） | 无 | 有（+1 美元/月） | 无（用 Turso）|
| **音乐生成** | ✅ 稳定 | ⚠️ 休眠后重连慢 | ✅ 稳定 | ⚠️ 易超时 |
| **国内访问速度** | 尚可 | 一般 | 尚可 | 快 |
| **配置难度** | 简单 | 简单 | 简单 | 中等 |

---

部署完有问题直接看云平台的「Logs / Metrics」面板，或者把错误信息发给我，我帮你排。
