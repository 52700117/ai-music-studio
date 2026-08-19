# syntax=docker/dockerfile:1

# ---- Build Stage ----
FROM node:20-alpine AS builder

# 缓存破坏：每次推送都重新 COPY，不使用旧缓存
ARG CACHE_BUST=20260819-v2

WORKDIR /app

# 安装依赖（利用缓存）
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install || npm install

# 先单独复制 release 目录（确保 zip 安装包不被缓存跳过）
COPY release/ ./release/

# 复制源码 + 构建前端
COPY . .
RUN npm run build || npx vite build

# 验证 release 目录内容（构建时打印，方便排查）
RUN echo "=== release 目录内容 ===" && ls -lh release/

# ---- Runtime Stage ----
FROM node:20-alpine

WORKDIR /app

# 生产依赖（最小化）
COPY package.json ./
RUN npm install --omit=dev && npm install tsx

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# 复制 release 目录（安装包直链下载）
COPY --from=builder /app/release/ ./release/

# 验证 release 目录已正确复制
RUN echo "=== runtime release 目录 ===" && ls -lh /app/release/

# 环境变量（可被 Railway 覆盖）
ENV NODE_ENV=production
ENV PORT=3001

# SQLite 数据库持久化目录（Railway Volume 挂载到 /data）
ENV RAILWAY_VOLUME_MOUNT_PATH=/data
RUN mkdir -p /data

EXPOSE 3001

CMD ["npx", "tsx", "server/server.ts"]
