/**
 * local server entry file, for local development AND pkg 打包版
 *  - 监听 0.0.0.0（同网段别的电脑也能访问，换机器打开更稳定）
 *  - pkg 打包版会把 dist/server/migrations 等资源外置在 resources/ 目录
 */
import app from './app.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;
// 0.0.0.0：支持局域网访问（换电脑 / 手机同网段都能打开）
const HOST = '0.0.0.0';

const server = (app as any).listen(Number(PORT), HOST, () => {
  const local = `http://localhost:${PORT}`;
  console.log(`✅ 音乐软件已启动`);
  console.log(`   本机访问: ${local}`);
  console.log(`   同网段访问: http://<你电脑局域网IP>:${PORT}`);
  console.log(`   管理后台: ${local}/admin`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;