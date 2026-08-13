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
