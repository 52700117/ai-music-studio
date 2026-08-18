#!/bin/bash
# 生成 macOS 免安装版（Intel x86_64 + Apple Silicon arm64）
# 产物：release/music-app-macos-x64/ 和 release/music-app-macos-arm64/
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  音乐创作软件 - macOS 免安装版打包工具"
echo "  产物：release/music-app-macos-x64 / music-app-macos-arm64"
echo "    拷到任何 Mac，双击「双击启动.command」就能用"
echo "============================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[X] 未检测到 Node.js，请先安装：https://nodejs.org/zh-cn/download/"
  exit 1
fi

echo "[1/6] 安装依赖..."
[ ! -d node_modules ] && npm install

echo "[2/6] 构建前端..."
npm run build

echo "[3/6] 安装 pkg..."
npm run release:install-pkg

mkdir -p release

build_arch() {
  local arch=$1
  local target=$2
  local bin=$3
  echo "[4/6] 打包 $arch 二进制..."
  npx pkg . --targets "$target" --output "release/$bin" || {
    echo "[!] 重试 pkg ($arch)..."
    PKG_CACHE_PATH="$HOME/.pkg-cache" npx pkg . --targets "$target" --output "release/$bin"
  }
  echo "[5/6] 组装资源 ($arch)..."
  node scripts/copy-resources.mjs "$arch"
}

build_arch "mac-x64" "node18-macos-x64" "music-app-mac-x64"
build_arch "mac-arm" "node18-macos-arm64" "music-app-mac-arm"

echo "[6/6] 打包成 zip..."
cd release
[ -f music-app-macos-x64.zip ] && rm music-app-macos-x64.zip
[ -f music-app-macos-arm64.zip ] && rm music-app-macos-arm64.zip
zip -qry music-app-macos-x64.zip music-app-macos-x64
zip -qry music-app-macos-arm64.zip music-app-macos-arm64
cd ..

echo "✅ 完成！产物："
ls -lh release/*.zip 2>/dev/null || ls -lh release/
echo "拷到 Mac 后解压，双击文件夹里的「双击启动.command」即可。"
open release
