#!/bin/bash
# Build NSIS installer for MusicApp
# Prepares staging directory + runs makensis

set -e

BUILD_DIR=".nsis-build"
STAGING="$BUILD_DIR/staging"

echo "=== 1. 清理旧的 staging 目录 ==="
rm -rf "$STAGING"
mkdir -p "$STAGING"/{dist,server/migrations,node_modules}

echo "=== 2. 复制 node.exe（便携版 Node.js）==="
cp ".nsis-build/node-win/node-v22.11.0-win-x64/node.exe" "$STAGING/node.exe"
ls -lh "$STAGING/node.exe"

echo "=== 3. 复制启动器 + 服务端 ==="
cp start-installer.mjs "$STAGING/"
cp dist-server/server.mjs "$STAGING/"
ls -lh "$STAGING/start-installer.mjs" "$STAGING/server.mjs"

echo "=== 4. 复制前端构建产物 ==="
cp -r dist/* "$STAGING/dist/"
du -sh "$STAGING/dist"

echo "=== 5. 复制数据库迁移 ==="
cp server/migrations/*.sql "$STAGING/server/migrations/"
ls -l "$STAGING/server/migrations/"

echo "=== 6. 复制 node_modules（仅 @libsql 相关）==="
# @libsql/client 及其依赖
mkdir -p "$STAGING/node_modules/@libsql"
mkdir -p "$STAGING/node_modules/@neon-rs"
mkdir -p "$STAGING/node_modules/libsql"

# @libsql 子包
for pkg in client core hrana-client isomorphic-ws linux-x64-gnu linux-x64-musl win32-x64-msvc; do
  if [ -d "node_modules/@libsql/$pkg" ]; then
    cp -r "node_modules/@libsql/$pkg" "$STAGING/node_modules/@libsql/"
    # 删除 Linux 原生二进制（安装包只给 Windows 用，减小体积）
    if [ "$pkg" = "linux-x64-gnu" ] || [ "$pkg" = "linux-x64-musl" ]; then
      rm -f "$STAGING/node_modules/@libsql/$pkg/index.node"
    fi
  fi
done

# @neon-rs/load
if [ -d "node_modules/@neon-rs/load" ]; then
  cp -r "node_modules/@neon-rs/load" "$STAGING/node_modules/@neon-rs/"
fi

# libsql 主包
if [ -d "node_modules/libsql" ]; then
  cp -r node_modules/libsql/* "$STAGING/node_modules/libsql/"
fi

# 其他依赖
for pkg in detect-libc js-base64 promise-limit ws; do
  if [ -d "node_modules/$pkg" ]; then
    cp -r "node_modules/$pkg" "$STAGING/node_modules/"
  fi
done

# 清理不需要的 Linux 二进制
find "$STAGING/node_modules" -name "*.node" -path "*/linux-*" -delete 2>/dev/null || true

echo "node_modules 大小："
du -sh "$STAGING/node_modules"
echo "包含的 .node 文件："
find "$STAGING/node_modules" -name "*.node" -exec ls -lh {} \;

echo ""
echo "=== 7. 检查暂存目录总大小 ==="
du -sh "$STAGING"

echo ""
echo "=== 8. 编译 NSIS 安装包 ==="
cd "$BUILD_DIR"
makensis MusicApp.nsi 2>&1

echo ""
echo "=== 9. 检查安装包 ==="
ls -lh MusicApp-Setup.exe 2>&1
echo ""
echo "✅ NSIS 安装包构建完成！"
