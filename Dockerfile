# syntax=docker/dockerfile:1

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖（利用缓存）
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install || npm install

# 复制源码 + 构建前端
COPY . .
RUN npm run build || npx vite build

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

# 环境变量（可被 Railway 覆盖）
ENV NODE_ENV=production
ENV PORT=3001

# SQLite 数据库持久化目录（Railway Volume 挂载到 /data）
ENV RAILWAY_VOLUME_MOUNT_PATH=/data
RUN mkdir -p /data

EXPOSE 3001

CMD ["npx", "tsx", "server/server.ts"]
