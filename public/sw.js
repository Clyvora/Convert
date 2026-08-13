const CACHE = 'clyvora-convert-v4'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.png', '/apple-touch-icon.png']

function storeResponse(event, request, response) {
  if (!response.ok) return
  const responseForCache = response.clone()
  event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, responseForCache)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  const isNavigation = event.request.mode === 'navigate'
  if (isNavigation) {
    event.respondWith(fetch(event.request).then((response) => {
      storeResponse(event, '/', response)
      return response
    }).catch(() => caches.match('/')))
    return
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    storeResponse(event, event.request, response)
    return response
  })))
})
