#!/bin/bash
# 生成 macOS 源码一键版 (需要 Node.js 18+)
set -e
cd "$(dirname "$0")"

OUT=release/music-app-source-mac
[ -d release ] || mkdir release
[ -d "$OUT" ] && rm -rf "$OUT"
mkdir -p "$OUT"

echo "[1/3] 复制源码..."
rsync -a --exclude='node_modules' --exclude='release' --exclude='.git' --exclude='dist' ./ "$OUT/"

echo "[2/3] 写启动脚本..."
START="$OUT/一键启动.command"
cat > "$START" <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[X] 请先安装 Node.js 18+：https://nodejs.org/zh-cn/download/"
  exit 1
fi
echo "[1/3] 安装依赖..."
[ ! -d node_modules ] && npm install
echo "[2/3] 构建前端..."
[ ! -d dist ] && npx vite build
echo "[3/3] 启动服务..."
open "http://localhost:3001"
npm start
EOF
chmod +x "$START"

echo "[3/3] 压缩..."
cd release
[ -f music-app-source-mac.zip ] && rm music-app-source-mac.zip
zip -qry music-app-source-mac.zip music-app-source-mac
cd ..

echo "✅ 完成：release/music-app-source-mac.zip"
open release
