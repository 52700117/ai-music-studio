// 手机 PWA 离线缓存 Service Worker（简单版本：缓存页面静态资源，保证 PWA 安装后启动快）
const CACHE_NAME = 'music-app-cache-v1'
const CORE_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 静态资源走缓存优先；API 请求 / 网页主文档走网络优先
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/audio/')) {
    // API 直接走网络，不缓存
    return
  }

  // 同源的静态资源：缓存优先
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req)
          .then((resp) => {
            const copy = resp.clone()
            if (resp.ok) {
              caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {})
            }
            return resp
          })
          .catch(() => cached || caches.match('/index.html'))
      })
    )
  }
})
