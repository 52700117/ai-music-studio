#!/bin/bash
clear
echo "============================================"
echo "  音乐软件 - iOS 手机 IPA 打包（仅 macOS）"
echo "  产物：iOS 安装包（.ipa）+ Xcode 工程"
echo "============================================"
echo ""

if [ "$(uname)" != "Darwin" ]; then
  echo "[错误] iOS 打包只能在 macOS 上进行！"
  echo "   Android APK 打包可在 Windows/macOS/Linux 上运行"
  read -n 1 -s -r -p "按任意键退出"
  exit 1
fi

# 检查 Node
if ! command -v node &> /dev/null; then
  echo "[错误] 未安装 Node.js：https://nodejs.org/zh-cn"
  read -n 1 -s -r -p "按任意键退出"
  exit 1
fi
# 检查 Xcode
if ! xcode-select -p &> /dev/null; then
  echo "[错误] 未安装 Xcode，请在 App Store 下载 Xcode 安装后再运行"
  read -n 1 -s -r -p "按任意键退出"
  exit 1
fi

echo "[1/4] 安装前端依赖..."
[ ! -d node_modules ] && npm install

echo "[2/4] 构建前端..."
[ ! -d dist ] && npm run build

echo "[3/4] 初始化 Capacitor iOS（首次运行）..."
if [ ! -d ios ]; then
  npx cap add ios
fi
npx cap sync ios

echo "[4/4] 打开 Xcode 进行签名 + 打包..."
echo ""
echo "============================================"
echo "  ⚙️  下一步：在 Xcode 里操作打包"
echo ""
echo "  1) 上面的命令已经打开了 Xcode（如果没打开，手动打开 ios/App/App.xcworkspace）"
echo "  2) 在左侧导航器里选中 App 项目 → Signing & Capabilities"
echo "  3) Team 选择你的 Apple ID（如果没有，先登录 Xcode 账号：Xcode → Settings → Accounts）"
echo "  4) Bundle Identifier 改成你自己的（例如 com.yourname.musicapp）"
echo "  5) 顶部选「Any iOS Device (arm64)」"
echo "  6) 菜单栏：Product → Archive"
echo "  7) 归档完成后点「Distribute App」→ 选「Ad Hoc」或「App Store」"
echo "  8) 最后导出 .ipa 安装包"
echo ""
echo "  💡 真机调试时：手机连 Mac，选设备 → 点三角形 ▶️ 运行"
echo "============================================"
echo ""
echo "💡 说明："
echo "   iOS App 打开的就是你云端永远在线的那个网站，"
echo "   网页版（https://music-app-production-9498.up.railway.app）不会消失！"
echo "   所有数据 100% 同步（账号、创作的音乐等）"
echo ""

npx cap open ios
read -n 1 -s -r -p "按任意键退出"
