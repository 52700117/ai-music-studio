#!/bin/bash
# macOS / Linux 一键启动脚本
# 双击或终端运行：bash 一键启动.command

clear
echo "========================================"
echo "     🎵 音乐软件 本地启动 (macOS/Linux)"
echo "========================================"
echo ""

cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js！请先安装 Node.js"
    echo "👉 下载地址：https://nodejs.org/ （LTS 版本）"
    echo ""
    read -p "按回车退出..." _
    exit 1
fi

if command -v pnpm &> /dev/null; then
    PKG=pnpm
else
    PKG=npm
fi

echo "[1/3] 安装依赖（仅首次）..."
if [ ! -d node_modules ]; then
    $PKG install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        read -p "按回车退出..." _
        exit 1
    fi
fi

echo ""
echo "[2/3] 构建前端..."
if [ ! -d dist ]; then
    npx vite build
fi

echo ""
echo "[3/3] 启动音乐软件服务..."
echo ""
echo "✅ 启动完成！请在浏览器打开："
echo "   👉 http://localhost:3001/          （前端首页）"
echo "   👉 http://localhost:3001/admin    （管理后台 admin/admin123）"
echo ""
echo "💡 按 Ctrl+C 停止服务"
echo ""
npm start
