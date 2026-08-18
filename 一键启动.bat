@echo off
chcp 65001 >nul
title 音乐软件 - 本地一键启动

echo ========================================
echo      🎵 音乐软件 本地启动
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js！请先安装 Node.js
    echo 👉 下载地址：https://nodejs.org/ （LTS 版本就行）
    echo.
    pause
    exit /b 1
)

REM 检查 pnpm 是否安装（没有就用 npm）
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    set PKG=pnpm
) else (
    set PKG=npm
)

echo [1/3] 安装依赖（第一次启动慢一点，后面秒开）...
if not exist node_modules (
    call %PKG% install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败，检查网络
        pause
        exit /b 1
    )
)

echo.
echo [2/3] 构建前端...
if not exist dist (
    call npx vite build
)

echo.
echo [3/3] 启动音乐软件服务...
echo.
echo ✅ 启动完成！请在浏览器打开：
echo    👉 http://localhost:3001/          （前端首页）
echo    👉 http://localhost:3001/admin    （管理后台 admin/admin123）
echo.
echo 💡 关闭本窗口就停止服务
echo.
call npm start
pause
