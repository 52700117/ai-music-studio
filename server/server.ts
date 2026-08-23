/**
 * local server entry file, for local development / pkg bundle / NSIS installer
 *  - Listen on 0.0.0.0 (LAN accessible)
 *  - Auto find available port starting from 3001 (EADDRINUSE -> try +1)
 *  - Write actual port to port.txt in BASE_DIR (so launcher/GUI can read it)
 */
import app from './app.js';
import fs from 'fs';
import path from 'path';

// 0.0.0.0: support LAN access
const HOST = '0.0.0.0';
const START_PORT = Number(process.env.PORT) || 3001;
const MAX_TRIES = 50;

function tryListen(port: number, tries: number): void {
  const server = (app as any).listen(port, HOST, () => {
    const local = `http://localhost:${port}`;
    console.log('');
    console.log('==========================================================');
    console.log('   Music Studio is running!');
    console.log('   Local access:    ' + local);
    console.log('   Admin panel:     ' + local + '/admin');
    console.log('   LAN access:      http://<your-ip>:' + port);
    console.log('==========================================================');
    console.log('');
    // Write port.txt so launcher/GUI can find us
    try {
      const baseDir = (app as any).BASE_DIR || process.cwd();
      const portFile = path.join(baseDir, 'port.txt');
      fs.writeFileSync(portFile, String(port), 'utf-8');
      // Also write to cwd as fallback
      try { fs.writeFileSync(path.join(process.cwd(), 'port.txt'), String(port), 'utf-8'); } catch {}
    } catch (e) {
      // silent — launcher will try 3001 first
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

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    server.close(() => process.exit(0));
  });
}

tryListen(START_PORT, MAX_TRIES);

export default app;
