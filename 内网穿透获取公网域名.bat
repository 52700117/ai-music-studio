@echo off
chcp 65001 >nul
title 内网穿透 - 获取公开域名

echo ========================================
echo   🌐 音乐软件内网穿透（CPolar/飞鸽）
echo ========================================
echo.
echo 本功能会给你的 localhost:3001 分配一个公网域名，
echo 即使你在外面（手机、别人电脑）也能访问音乐软件！
echo.
echo 推荐两种免费工具，任选一个：
echo.
echo ====================================================
echo 方案 A：飞鸽穿透（国内访问快，微信登录）
echo ====================================================
echo 1. 打开 https://www.fgnx.net 下载飞鸽客户端并安装
echo 2. 打开飞鸽 → 微信扫码登录
echo 3. 点「隧道」→「添加隧道」
echo    - 隧道名称：music-app
echo    - 协议类型：HTTP
echo    - 本地端口：3001
echo    - 隧道节点：选免费的（如 中国-香港 / 新加坡）
echo 4. 点「启动隧道」，会给你一个域名，例如：
echo    https://abc123.free.fgnx.net
echo 5. 这个就是你的公开网址！全世界都能访问。
echo.
echo ====================================================
echo 方案 B：ngrok（国际通用，有免费版）
echo ====================================================
echo 1. 打开 https://ngrok.com 注册（免费）
echo 2. 下载 ngrok.exe 放到本项目文件夹
echo 3. 打开命令行（在本项目文件夹内）运行：
echo    ngrok config add-authtoken 你的token
echo    ngrok http 3001
echo 4. 会出现类似：Forwarding  https://xxxx.ngrok-free.app -> http://localhost:3001
echo 5. 那个 https://xxxx.ngrok-free.app 就是你的公网域名。
echo.
echo ====================================================
echo 方案 C：localtunnel（零安装，npm 一行命令搞定）
echo ====================================================
echo 1. 先确保音乐软件已经在运行（npm start）
echo 2. 新开一个命令行窗口，cd 到本项目文件夹，运行：
echo    npx localtunnel --port 3001
echo 3. 会显示：your url is: https://xxxxx.loca.lt
echo 4. 复制这个网址在浏览器打开（第一次需要按页面提示点 Click to Continue）
echo.
echo 💡 注意：免费工具每次启动域名可能会变。要固定域名需付费版。
echo 💡 如果是让自己访问，方案 C 最简单（不用注册下载）。
echo.
pause
