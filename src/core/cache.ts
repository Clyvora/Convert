export async function clearCachedMediaEngineFiles(storage: CacheStorage): Promise<number> {
  let removed = 0
  const cacheNames = (await storage.keys()).filter((name) => name.startsWith('clyvora-convert'))
  await Promise.all(cacheNames.map(async (name) => {
    const cache = await storage.open(name)
    const requests = await cache.keys()
    await Promise.all(requests.map(async (request) => {
      if (!new URL(request.url).pathname.includes('/ffmpeg/')) return
      if (await cache.delete(request)) removed += 1
    }))
  }))
  return removed
}

export async function resetOfflineApplication(storage: CacheStorage): Promise<number> {
  const cacheNames = (await storage.keys()).filter((name) => name.startsWith('clyvora-convert'))
  const results = await Promise.all(cacheNames.map((name) => storage.delete(name)))
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
  return results.filter(Boolean).length
}
