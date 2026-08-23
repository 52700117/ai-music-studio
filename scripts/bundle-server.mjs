/**
 * Bundle server TypeScript → single CJS file for NSIS installer
 * - Inlines express, cors, dotenv, all routes
 * - Marks @libsql/client as external (native .node binary can't be bundled)
 * - Outputs to dist-server/server.cjs
 */
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'

const outDir = path.resolve('dist-server')
fs.mkdirSync(outDir, { recursive: true })

await build({
  entryPoints: ['server/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: path.join(outDir, 'server.mjs'),
  external: ['@libsql/client'],
  banner: {
    // Polyfill require() for CJS deps (express, body-parser, etc.) in ESM context
    js: `// Bundled by esbuild for NSIS installer - do not edit manually
// @libsql/client is external (native binary loaded at runtime)
import { createRequire as __createRequire } from 'module';
const require = __createRequire(import.meta.url);`,
  },
  logLevel: 'info',
})

console.log('✅ Server bundled to dist-server/server.mjs')

// Check size
const stat = fs.statSync(path.join(outDir, 'server.mjs'))
console.log(`   Size: ${(stat.size / 1024).toFixed(1)} KB`)
