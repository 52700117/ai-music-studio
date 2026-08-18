import type { CapacitorConfig } from '@capacitor/cli'

// 📱 手机 App 配置（Capacitor）
// 核心：App 内部直接打开你云端永远在线的网址，
//      网页版（PWA / 浏览器访问）永远不消失，两边 100% 数据同步。
const config: CapacitorConfig = {
  appId: 'com.music.app',
  appName: '音乐创作软件',
  webDir: 'dist',
  server: {
    // 直接加载云端网址（这样打包出的 apk/ipa 体积小，功能同步最新）
    url: 'https://music-app-production-9498.up.railway.app',
    androidScheme: 'https',
    allowNavigation: [
      'https://music-app-production-9498.up.railway.app',
      'https://*.railway.app',
      'https://api.minimax.chat',
      'https://*.minimax.chat',
    ],
    cleartext: false,
  },
  android: {
    buildOptions: {
      signingType: 'apk',
    },
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#FFF8F0',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1A1A1A',
      overlaysWebView: true,
    },
  },
}

export default config
