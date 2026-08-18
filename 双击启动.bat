@echo off
chcp 65001 >nul
title 音乐创作软件 - 一键启动 (源码版)
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo    音乐创作软件 - 源码一键启动
echo    前端: http://localhost:3001
echo    后台: http://localhost:3001/admin
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [X] 未检测到 Node.js，请先安装 Node.js 18+
  echo     下载地址: https://nodejs.org/zh-cn/download/
  echo.
  pause
  exit /b 1
)

echo [1/3] 检查依赖...
if not exist node_modules (
  echo   首次启动，正在安装依赖（约 2-5 分钟，只装一次）...
  call npm install
  if errorlevel 1 (
    echo [X] 依赖安装失败，请检查网络
    pause
    exit /b 1
  )
) else (
  echo   ✅ 依赖已就绪
)

echo.
echo [2/3] 检查前端构建产物...
if not exist dist\index.html (
  echo   首次启动，正在构建前端（约 1-2 分钟，只装一次）...
  call npx vite build
  if errorlevel 1 (
    echo [X] 前端构建失败
    pause
    exit /b 1
  )
) else (
  echo   ✅ 前端已构建
)

echo.
echo [3/3] 启动音乐创作软件...
start "" http://localhost:3001
echo.
echo ✅ 浏览器已自动打开 http://localhost:3001
echo    如果没有弹出，请手动在浏览器输入上面的地址
echo.
echo    管理后台: http://localhost:3001/admin
echo.
echo    ⚠️ 关闭本窗口 = 关闭音乐软件
echo.
call npm start
pause
endlocal
