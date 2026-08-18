#!/bin/bash
clear

echo "============================================"
echo "  音乐软件 - macOS 桌面版一键打包"
echo "  打包产物：macOS .dmg 安装包"
echo "============================================"
echo ""

# 检查 Node
if ! command -v node &> /dev/null; then
  echo "[错误] 未安装 Node.js，请去 https://nodejs.org/zh-cn 下载安装 LTS 版"
  read -n 1 -s -r -p "按任意键退出"
  exit 1
fi

# 检查 Rust
if ! command -v rustc &> /dev/null; then
  echo "[提示] 未检测到 Rust，正在安装..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi

# 检查 Xcode CLT
if ! xcode-select -p &> /dev/null; then
  echo "[提示] 安装 Xcode Command Line Tools..."
  xcode-select --install
fi

echo "[1/3] 安装前端依赖..."
[ ! -d node_modules ] && npm install

echo "[2/3] 开始打包桌面版（通用二进制：Intel + Apple Silicon）..."
npm run app:build:mac

echo "[3/3] 打包完成！"
echo ""
echo "============================================"
echo "  ✅ 打包成功！"
echo "  📦 安装包位置："
echo "     src-tauri/target/universal-apple-darwin/release/bundle/"
echo ""
echo "     - DMG 安装包（推荐）：dmg/音乐创作软件_1.0.0_universal.dmg"
echo "     - macOS App：         macos/音乐创作软件.app"
echo "============================================"
echo ""
echo "💡 说明："
echo "   软件版打开的就是你云端永远在线的那个网站，"
echo "   网页版（https://music-app-production-9498.up.railway.app）不会消失！"
echo "   两边数据 100% 同步。"
echo ""
read -n 1 -s -r -p "按任意键退出"
