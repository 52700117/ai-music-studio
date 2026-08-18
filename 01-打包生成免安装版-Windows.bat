@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 生成音乐软件【免安装版】Windows - 前后端一体 (music-app-windows 目录)
echo ============================================================
echo   音乐创作软件 - Windows 免安装版打包工具
echo   产物：release\music-app-windows\
echo     music-app.exe + resources\ + 双击启动.bat
echo   拷到任何 Windows 电脑，双击「双击启动.bat」就能用
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [X] 未检测到 Node.js，请先安装 Node.js 18+：
  echo     https://nodejs.org/zh-cn/download/
  pause
  exit /b 1
)

echo [1/6] 安装项目依赖...
if not exist node_modules (
  call npm install
  if errorlevel 1 ( echo [X] 依赖安装失败 & pause & exit /b 1 )
)

echo [2/6] 构建前端 (dist)...
call npm run build
if errorlevel 1 ( echo [X] 前端构建失败 & pause & exit /b 1 )

echo [3/6] 安装 pkg 打包工具...
call npm run release:install-pkg
if errorlevel 1 ( echo [X] pkg 安装失败 & pause & exit /b 1 )

echo [4/6] 打包成 music-app.exe ...
if not exist release mkdir release
call npx pkg . --targets node18-win-x64 --output release\music-app.exe
if errorlevel 1 (
  echo [!] pkg 直连失败，尝试切换国内镜像...
  set PKG_CACHE_PATH=%USERPROFILE%\.pkg-cache
  if not exist "!PKG_CACHE_PATH!" mkdir "!PKG_CACHE_PATH!"
  call npx pkg . --targets node18-win-x64 --output release\music-app.exe
  if errorlevel 1 ( echo [X] pkg 打包失败，检查网络/代理 & pause & exit /b 1 )
)

echo [5/6] 组装资源 (resources\)...
if not exist scripts mkdir scripts
call node scripts\copy-resources.mjs win
if errorlevel 1 ( echo [X] 资源组装失败 & pause & exit /b 1 )

echo [6/6] 生成最终压缩包 release\music-app-windows.zip ...
where tar >nul 2>&1
if not errorlevel 1 (
  cd release
  if exist music-app-windows.zip del music-app-windows.zip
  tar -acf music-app-windows.zip music-app-windows
  cd ..
  echo.
  echo ✅ 生成完成：release\music-app-windows.zip
  echo    解压后把 music-app-windows 文件夹拷到任何 Windows 电脑
  echo    双击里面的「双击启动.bat」，浏览器自动打开 http://localhost:3001
  echo    管理后台地址：http://localhost:3001/admin
) else (
  echo [提示] 未找到 tar，跳过自动压缩。你手动把 release\music-app-windows\ 整个目录压缩发送即可。
)

echo.
echo 📂 打开产物目录...
if exist release\music-app-windows explorer release\
pause
endlocal
