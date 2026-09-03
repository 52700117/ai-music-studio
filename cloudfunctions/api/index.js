/**
 * CloudBase 云函数入口
 *
 *  运行环境：CloudBase SCF (Nodejs18+)
 *  Handler 配置：index.main（默认）
 *
 *  作用：用 serverless-http 把 Express app (server/app.js)
 *       包装成符合 SCF 事件/响应格式的 handler。
 */
process.env.TZ = 'Asia/Shanghai';

// --- 启动过程中任何未捕获的异常都返回 500 JSON，不要让函数直接 5xx 崩掉
process.on('unhandledRejection', (e) => {
  console.error('[SCF] unhandledRejection:', e && e.message ? e.message : e);
});
process.on('uncaughtException', (e) => {
  console.error('[SCF] uncaughtException:', e && e.message ? e.message : e);
});

let serverless;
let app;
let lastErr = null;

function loadExpress() {
  if (app) return;
  try {
    // dist-server/app.js 是 Express app 的默认导出
    const mod = require('./server/app.js');
    app = mod.default || mod;
    const serverlessHttp = require('serverless-http');
    // provider: 'tencent' —— serverless-http 会处理 API GW / SCF 事件结构
    serverless = serverlessHttp(app, {
      provider: 'tencent',
      binary: true,
      request: (req, event) => {
        // 把 SCF 里的请求 ID 塞到请求对象里，方便日志跟踪
        req.scfRequestId = event.requestContext && event.requestContext.requestId || event.requestId || null;
        return req;
      },
    });
  } catch (e) {
    lastErr = e;
    console.error('[SCF] 加载 Express app 失败:', e && e.stack ? e.stack : e);
  }
}

// 首请求热加载（CloudBase 函数冷启动时才执行一次，后续复用实例）
loadExpress();

/**
 * HTTP 触发器 + CloudBase HTTP 访问服务两种入口事件：
 *   - 云函数「SCF HTTP 触发器」事件结构（apigw）
 *   - CloudBase 也兼容 serverless-http 的 tencent provider
 */
exports.main = async function mainHandler(event, context) {
  // 首次加载失败就重新尝试（node_modules 首次拷贝慢时可能发生），再不行直接返回错误
  if (!serverless) loadExpress();
  if (!serverless) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      },
      body: JSON.stringify({
        success: false,
        error: '服务器初始化失败',
        detail: lastErr ? String(lastErr.message || lastErr) : 'loadExpress returned empty',
      }),
    };
  }

  try {
    const resp = await serverless(event, context);
    // 确保响应头含 CORS（即使某些异常路径 serverless-http 没带上）
    if (!resp.headers) resp.headers = {};
    if (!resp.headers['access-control-allow-origin']) {
      resp.headers['Access-Control-Allow-Origin'] = event.headers && event.headers.origin ? event.headers.origin : '*';
    }
    if (!resp.headers['access-control-allow-headers']) {
      resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
    }
    if (!resp.headers['access-control-allow-methods']) {
      resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    }
    return resp;
  } catch (e) {
    console.error('[SCF] 执行失败:', e && e.stack ? e.stack : e);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: false, error: '云函数执行错误', detail: String(e.message || e) }),
    };
  }
};
