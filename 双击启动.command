#!/bin/bash
# 音乐创作软件 - 一键启动 (macOS / Linux 源码版)
cd "$(dirname "$0")"

echo ""
echo "============================================================"
echo "   音乐创作软件 - 源码一键启动"
echo "   前端: http://localhost:3001"
echo "   后台: http://localhost:3001/admin"
echo "============================================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[X] 未检测到 Node.js，请先安装 Node.js 18+"
  echo "    下载地址: https://nodejs.org/zh-cn/download/"
  echo "    macOS 也可以执行: brew install node@18"
  exit 1
fi

echo "[1/3] 检查依赖..."
if [ ! -d node_modules ]; then
  echo "  首次启动，正在安装依赖（约 2-5 分钟，只装一次）..."
  npm install
  if [ $? -ne 0 ]; then
    echo "[X] 依赖安装失败，请检查网络"
    exit 1
  fi
else
  echo "  ✅ 依赖已就绪"
fi

echo ""
echo "[2/3] 检查前端构建产物..."
if [ ! -f dist/index.html ]; then
  echo "  首次启动，正在构建前端（约 1-2 分钟，只装一次）..."
  npx vite build
  if [ $? -ne 0 ]; then
    echo "[X] 前端构建失败"
    exit 1
  fi
else
  echo "  ✅ 前端已构建"
fi

echo ""
echo "[3/3] 启动音乐创作软件..."
sleep 1 && open "http://localhost:3001" 2>/dev/null || xdg-open "http://localhost:3001" 2>/dev/null || echo "请手动打开: http://localhost:3001"
echo ""
echo "✅ 浏览器已自动打开 http://localhost:3001"
echo "   如果没有弹出，请手动在浏览器输入上面的地址"
echo ""
echo "   管理后台: http://localhost:3001/admin"
echo ""
echo "   ⚠️ Ctrl+C = 关闭音乐软件"
echo ""
npm start
