@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 生成音乐软件【源码一键版】Windows 压缩包 (需要 Node.js)
echo ============================================================
echo   音乐创作软件 - Windows 源码一键版打包工具
echo   产物：release\music-app-source-windows.zip
echo   解压后：双击「一键启动.bat」自动装依赖+构建+启动
echo   （需要用户电脑安装 Node.js 18+）
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [提示] 本工具本机需 Node.js，若没有请先装：https://nodejs.org/zh-cn/
)

if not exist release mkdir release
set OUT=release\music-app-source-windows
if exist %OUT% rmdir /s /q %OUT%
mkdir %OUT%

echo [1/3] 复制项目源码（排除 node_modules / release / .git / dist）...
for /d %%D in (*) do (
  if /i not "%%D"=="node_modules" if /i not "%%D"=="release" if /i not "%%D"==".git" if /i not "%%D"=="dist" (
    xcopy "%%D" "%OUT%\%%D\" /E /I /Y /Q >nul
  )
)
for %%F in (*.*) do (
  if /i not "%%F"=="package-lock.json" (
    xcopy "%%F" "%OUT%\" /Y /Q >nul
  )
)
:: package.json 必须单独复制
if exist package.json xcopy package.json %OUT%\ /Y /Q >nul

echo [2/3] 复制「一键启动.bat」...
if exist 一键启动.bat (
  xcopy 一键启动.bat %OUT%\ /Y /Q >nul
) else (
  echo @echo off> %OUT%\一键启动.bat
  echo chcp 65001 ^>nul>> %OUT%\一键启动.bat
  echo title 音乐创作软件 - 源码版>> %OUT%\一键启动.bat
  echo cd /d "%%~dp0">> %OUT%\一键启动.bat
  echo where node ^>nul 2^>^&1>> %OUT%\一键启动.bat
  echo if errorlevel 1 (>> %OUT%\一键启动.bat
  echo   echo [X] 请先安装 Node.js 18+：https://nodejs.org/zh-cn/>> %OUT%\一键启动.bat
  echo   pause>> %OUT%\一键启动.bat
  echo   exit /b 1>> %OUT%\一键启动.bat
  echo )>> %OUT%\一键启动.bat
  echo echo [1/3] 安装依赖...>> %OUT%\一键启动.bat
  echo if not exist node_modules call npm install>> %OUT%\一键启动.bat
  echo echo [2/3] 构建前端...>> %OUT%\一键启动.bat
  echo if not exist dist call npx vite build>> %OUT%\一键启动.bat
  echo echo [3/3] 启动服务...>> %OUT%\一键启动.bat
  echo start "" http://localhost:3001>> %OUT%\一键启动.bat
  echo call npm start>> %OUT%\一键启动.bat
  echo pause>> %OUT%\一键启动.bat
)

echo [3/3] 生成 zip ...
where tar >nul 2>&1
if not errorlevel 1 (
  cd release
  if exist music-app-source-windows.zip del music-app-source-windows.zip
  tar -acf music-app-source-windows.zip music-app-source-windows
  cd ..
  echo ✅ 完成：release\music-app-source-windows.zip
) else (
  echo [提示] 手动压缩：%OUT%
)

if exist %OUT% explorer %OUT%
pause
endlocal
