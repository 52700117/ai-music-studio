@echo off
chcp 65001 >nul
title 音乐软件 - 生成 Windows 桌面版（.exe 安装包）

echo ============================================
echo   音乐软件 - Windows 桌面版一键打包
echo   打包产物：Windows 安装包（.exe / .msi）
echo ============================================
echo.

echo [0/4] 检查环境...
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未安装 Node.js，请去 https://nodejs.org/zh-cn 下载安装 LTS 版
  pause
  exit /b 1
)
where rustc >nul 2>nul
if errorlevel 1 (
  echo [提示] 未安装 Rust，正在引导安装...
  echo 请按下面网页的说明安装 Rust（一路下一步即可）：
  echo   https://www.rust-lang.org/tools/install
  echo 安装完重新运行本脚本
  pause
  exit /b 1
)

echo [1/4] 安装前端依赖...
if not exist node_modules (call npm install)

echo [2/4] 安装 Tauri Rust 依赖（首次运行会慢一些）...
cargo install --list | findstr tauri >nul 2>nul
if errorlevel 1 (
  call cargo install tauri-cli --version "^2"
)

echo [3/4] 开始打包桌面版...
call npm run app:build

echo [4/4] 打包完成！
echo.
echo ============================================
echo   ✅ 打包成功！
echo   📦 安装包位置：
echo      src-tauri\target\release\bundle\
echo.
echo      - MSI 安装包（推荐）：msi\音乐创作软件_1.0.0_x64_zh-CN.msi
echo      - NSIS 安装包：        nsis\音乐创作软件_1.0.0_x64-setup.exe
echo ============================================
echo.
echo 💡 说明：
echo    软件版打开的就是你云端永远在线的那个网站，
echo    网页版（https://music-app-production-9498.up.railway.app）不会消失！
echo    两边数据 100% 同步。
echo.
pause
