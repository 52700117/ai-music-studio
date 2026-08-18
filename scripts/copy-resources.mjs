/**
 * 打包后把运行时需要的资源复制到 release/resources/ 目录（与 exe 同级）
 * 调用方式：node scripts/copy-resources.mjs <win|mac-x64|mac-arm>
 */
import fs from 'node:fs'
import path from 'node:path'

const platform = process.argv[2] || 'win'
const ROOT = path.resolve(import.meta.dirname, '..')
const RELEASE = path.join(ROOT, 'release')
const DIST_OUT = path.join(RELEASE, 'resources')

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dst, { recursive: true })
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name)
    const d = path.join(dst, ent.name)
    if (ent.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

function copyIfExists(src, dst) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    const stat = fs.statSync(src)
    if (stat.isDirectory()) copyDir(src, dst)
    else fs.copyFileSync(src, dst)
  }
}

// 1) 清理旧 resources
if (fs.existsSync(DIST_OUT)) fs.rmSync(DIST_OUT, { recursive: true, force: true })
fs.mkdirSync(DIST_OUT, { recursive: true })

// 2) 前端构建产物 dist/
copyIfExists(path.join(ROOT, 'dist'), path.join(DIST_OUT, 'dist'))

// 3) 源码（tsx 需要读到原始 .ts 文件，pkg 内 snapshot 有时读不到）
copyDir(path.join(ROOT, 'server'), path.join(DIST_OUT, 'server'))
copyDir(path.join(ROOT, 'src'), path.join(DIST_OUT, 'src'))
copyDir(path.join(ROOT, 'public'), path.join(DIST_OUT, 'public'))

// 4) 数据目录（空目录，首次运行自动创建 app.db）
fs.mkdirSync(path.join(DIST_OUT, 'data'), { recursive: true })
fs.writeFileSync(path.join(DIST_OUT, 'data', '.gitkeep'), '')

// 5) 依赖（全部 node_modules 拷贝，避免 pkg 动态 require 漏打）
copyDir(path.join(ROOT, 'node_modules'), path.join(DIST_OUT, 'node_modules'))

// 6) 配置
copyIfExists(path.join(ROOT, 'package.json'), path.join(DIST_OUT, 'package.json'))
copyIfExists(path.join(ROOT, 'tsconfig.json'), path.join(DIST_OUT, 'tsconfig.json'))
copyIfExists(path.join(ROOT, 'vite.config.ts'), path.join(DIST_OUT, 'vite.config.ts'))
copyIfExists(path.join(ROOT, 'start.js'), path.join(DIST_OUT, 'start.js'))
if (fs.existsSync(path.join(ROOT, '.env'))) {
  copyIfExists(path.join(ROOT, '.env'), path.join(DIST_OUT, '.env'))
}

// 7) 根据平台把 exe / mac 二进制也放到 release/ 根并生成最终 zip
//    资源结构：
//    music-app-windows/
//      music-app.exe
//      resources/  <-- 上面这些
const PLATFORM_DIR_NAME = {
  'win': 'music-app-windows',
  'mac-x64': 'music-app-macos-x64',
  'mac-arm': 'music-app-macos-arm64',
}[platform] || 'music-app-windows'

const FINAL_DIR = path.join(RELEASE, PLATFORM_DIR_NAME)
if (fs.existsSync(FINAL_DIR)) fs.rmSync(FINAL_DIR, { recursive: true, force: true })
fs.mkdirSync(FINAL_DIR, { recursive: true })

// 移动 resources 到最终目录
fs.renameSync(DIST_OUT, path.join(FINAL_DIR, 'resources'))

// 移动对应 exe / 二进制
const exeMap = {
  'win': 'music-app.exe',
  'mac-x64': 'music-app-mac-x64',
  'mac-arm': 'music-app-mac-arm',
}
const binaryIn = path.join(RELEASE, exeMap[platform] || 'music-app.exe')
if (fs.existsSync(binaryIn)) {
  const binaryOut = path.join(FINAL_DIR, platform === 'win' ? 'music-app.exe' : 'music-app')
  fs.copyFileSync(binaryIn, binaryOut)
  if (platform !== 'win') fs.chmodSync(binaryOut, 0o755)
} else {
  console.warn(`[提示] 未找到打包产物 ${binaryIn}，请先执行 pkg 生成对应平台二进制。`)
}

// 写一个「双击启动.bat / .sh」方便用户
if (platform === 'win') {
  fs.writeFileSync(path.join(FINAL_DIR, '双击启动.bat'), [
    '@echo off',
    'chcp 65001 >nul',
    'title 音乐创作软件',
    'cd /d "%~dp0"',
    'start "" http://localhost:3001',
    'music-app.exe',
    'pause',
  ].join('\r\n'))
} else {
  const sh = path.join(FINAL_DIR, '双击启动.command')
  fs.writeFileSync(sh, [
    '#!/bin/bash',
    'cd "$(dirname "$0")"',
    'open "http://localhost:3001"',
    './music-app',
  ].join('\n'))
  fs.chmodSync(sh, 0o755)
}

console.log(`✅ 打包资源准备完成 -> ${FINAL_DIR}`)
console.log(`   用户把整个 ${PLATFORM_DIR_NAME} 文件夹拷到任何电脑，`)
console.log(`   双击里面的 双击启动.bat（Windows）或 双击启动.command（Mac）即可启动！`)
