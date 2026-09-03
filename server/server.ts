/**
 * 服务入口
 *   - 本地开发 / pkg 打包 / Railway / Render ：直接 listen(port, '0.0.0.0')
 *   - 腾讯云 CloudBase 云托管：读取 TCB_PORT（CloudRun 注入）绑定 127.0.0.1
 */
import app from './app.js';
import fs from 'fs';
import path from 'path';

const MAX_TRIES = 50;

// CloudBase 云托管会注入 TCB_LISTEN_ADDR 或 PORT；本地默认 3001
const ENV_PORT = Number(process.env.TCB_PORT || process.env.PORT || 3001);
const HOST = process.env.TCB_LISTEN_ADDR || (process.env.CLOUDBASE_RUN_MODE ? '127.0.0.1' : '0.0.0.0');
const IS_CLOUDBASE = !!process.env._SCF_TIMESTAMP || !!process.env.CLOUDBASE_ENV_ID || !!process.env.TCB_ENV || !!process.env.CLOUDBASE_RUN_MODE;

function tryListen(port: number, tries: number): void {
  const server = (app as any).listen(port, HOST, () => {
    const local = `http://localhost:${port}`;
    console.log('');
    console.log('==========================================================');
    console.log(IS_CLOUDBASE ? '   Music Studio is running on CloudBase!' : '   Music Studio is running!');
    console.log('   Local access:    ' + local);
    console.log('   Admin panel:     ' + local + '/admin');
    if (!IS_CLOUDBASE) {
      console.log('   LAN access:      http://<your-ip>:' + port);
    }
    console.log('==========================================================');
    console.log('');
    if (!IS_CLOUDBASE) {
      try {
        const baseDir = (app as any).BASE_DIR || process.cwd();
        const portFile = path.join(baseDir, 'port.txt');
        fs.writeFileSync(portFile, String(port), 'utf-8');
        try { fs.writeFileSync(path.join(process.cwd(), 'port.txt'), String(port), 'utf-8'); } catch {}
      } catch { /* silent */ }
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' && tries > 0) {
      console.log('[port] ' + port + ' is in use, trying ' + (port + 1));
      server.close(() => {});
      tryListen(port + 1, tries - 1);
      return;
    }
    console.error('[server error]', err.message);
    process.exit(1);
  });

  process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
  process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
}

tryListen(ENV_PORT, MAX_TRIES);

export default app;
