@echo off
chcp 65001 >nul
title 音乐软件 - Android 安装包（简化：用 Android Studio 打开 .apk）
echo ============================================
echo   音乐软件 - Android 手机 App 初始化
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 先装 Node.js LTS：https://nodejs.org/zh-cn
  pause
  exit /b 1
)

if not exist node_modules (call npm install)
if not exist dist (call npm run build)
if not exist android (call npx cap add android)
call npx cap sync android

echo.
echo ✅ 准备完成！现在打开 Android Studio：
echo    1) 打开 Android Studio
echo    2) 选「Open an existing project」
echo    3) 选项目里的 android 文件夹打开
echo    4) 右上角 ▶️ Run 按钮（手机连电脑 / 开模拟器）
echo    5) 要生成 apk：Build → Build Bundle(s)/APK → Build APK(s)
echo       产物：android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
