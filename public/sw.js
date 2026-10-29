const CACHE_PREFIX = 'clyvora-convert-'
const CACHE = `${CACHE_PREFIX}mewvi-brand-v5-2026-10-29`
const SHELL = ['/', '/manifest.webmanifest', '/brand-cat-transparent.svg', '/favicon.svg', '/brand-cat.webp', '/app-icon.webp', '/theme-init.js', '/apple-touch-icon.png']
const MASCOTS = ['sitting', 'working', 'confused', 'ready', 'sleeping', 'local', 'curious', 'pounce'].map(pose => `/mascot/${pose}.png`)

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
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/') || url.pathname.startsWith('/artifacts/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request)
      .then((response) => cacheSuccessful('/', response))
      .catch(() => caches.match('/')))
    return
  }

  const immutableAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/ffmpeg/runtime/v') || MASCOTS.includes(url.pathname)
  if (immutableAsset) {
    event.respondWith(caches.match(event.request).catch(() => undefined).then((cached) => cached
      || fetch(event.request).then((response) => cacheSuccessful(event.request, response))))
    return
  }

  if (SHELL.includes(url.pathname)) event.respondWith(fetch(event.request)
    .then((response) => cacheSuccessful(event.request, response))
    .catch(() => caches.match(event.request)))
})
