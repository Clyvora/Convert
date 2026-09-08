const CACHE_PREFIX = 'clyvora-convert-'
const CACHE = `${CACHE_PREFIX}brand-2026-09-08`
const SHELL = ['/', '/manifest.webmanifest', '/app-icon.webp', '/theme-init.js', '/apple-touch-icon.png']

async function cacheSuccessful(request, response) {
  if (response.ok && response.type === 'basic') {
    try { await (await caches.open(CACHE)).put(request, response.clone()) } catch { /* Cache storage is optional. Keep the successful network response. */ }
  }
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
  )))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // Never persist API responses, download tickets, or retrieved user media.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request)
      .then((response) => cacheSuccessful('/', response))
      .catch(() => caches.match('/')))
    return
  }

  const immutableAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/ffmpeg/runtime/v')
  if (immutableAsset) {
    event.respondWith(caches.match(event.request).catch(() => undefined).then((cached) => cached
      || fetch(event.request).then((response) => cacheSuccessful(event.request, response))))
    return
  }

  event.respondWith(fetch(event.request)
    .then((response) => cacheSuccessful(event.request, response))
    .catch(() => caches.match(event.request)))
})
