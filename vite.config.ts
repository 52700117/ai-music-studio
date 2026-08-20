import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import fs from 'node:fs'
import path from 'node:path'

// 版本文件插件：
// 1) 在 transformIndexHtml 阶段往 index.html 注入 <meta name="app-version" />（前端启动时读取当前版本）
// 2) 在 closeBundle（产物已写入 outDir 后）写入 version.json 到 dist 目录，避免被清空目录流程覆盖
function versionPlugin(): Plugin {
  const version = String(Date.now())
  let outDir = 'dist'
  return {
    name: 'version-plugin',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist'
    },
    transformIndexHtml(html) {
      // 注入 meta 标签，避免与其他 meta 冲突
      return html.replace(
        '<meta name="description" content="降低创作门槛，让每个人都能写一首自己的歌" />',
        `<meta name="description" content="降低创作门槛，让每个人都能写一首自己的歌" />\n    <meta name="app-version" content="${version}" />`,
      )
    },
    closeBundle() {
      try {
        const versionFile = path.resolve(outDir, 'version.json')
        fs.mkdirSync(outDir, { recursive: true })
        fs.writeFileSync(
          versionFile,
          JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2),
          'utf-8',
        )
        console.log(`[version-plugin] wrote ${versionFile} with version=${version}`)
      } catch (err) {
        console.error('[version-plugin] failed to write version.json', err)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    versionPlugin(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    watch: {
      ignored: ['**/node_modules/**', '**/.pnpm-store/**', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/audio': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
