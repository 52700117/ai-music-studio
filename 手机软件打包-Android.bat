@echo off
chcp 65001 >nul
title 音乐软件 - 生成 Android 手机安装包（.apk）

echo ============================================
echo   音乐软件 - Android 手机 APK 一键打包
echo   产物：安卓手机安装包（.apk）
echo ============================================
echo.

echo [0/6] 检查环境...
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未安装 Node.js，请去 https://nodejs.org/zh-cn 下载 LTS 版
  pause
  exit /b 1
)
where java >nul 2>nul
if errorlevel 1 (
  echo [错误] 未安装 JDK 17+，请去 https://adoptium.net/ 下载 Temurin JDK 17 并安装
  pause
  exit /b 1
)
if "%ANDROID_HOME%"=="" (
  if "%ANDROID_SDK_ROOT%"=="" (
    echo [警告] 未设置 ANDROID_HOME，建议安装 Android Studio 自动配置
    echo   下载地址：https://developer.android.com/studio
  )
)

echo [1/6] 安装前端依赖...
if not exist node_modules (call npm install)

echo [2/6] 构建前端...
if not exist dist (call npm run build)

echo [3/6] 初始化 Capacitor（首次运行）...
if not exist android (
  call npx cap add android
)

echo [4/6] 同步配置到 Android 项目...
call npx cap sync android

echo [5/6] 生成签名密钥（首次运行生成 keystore.jks）...
if not exist keystore.jks (
  keytool -genkey -v -keystore keystore.jks -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=MusicApp, OU=MusicApp, O=MusicApp, L=Beijing, S=Beijing, C=CN"
)

echo [6/6] 构建 Android APK 安装包...
call npx cap build android --keystorepath ./keystore.jks --keystorepass android --keystorealias androiddebugkey --keystorealiaspass android

echo.
echo ============================================
echo   ✅ APK 打包完成！
echo   📦 安装包位置：
echo      android\app\build\outputs\apk\release\app-release.apk
echo.
echo   💡 发送到 Android 手机，打开即可安装使用
echo ============================================
echo.
echo 💡 说明：
echo    手机 App 打开的就是你云端永远在线的那个网站，
echo    网页版（https://music-app-production-9498.up.railway.app）不会消失！
echo    所有数据 100% 同步（账号、创作的音乐等）
echo.
pause
