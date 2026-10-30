import { afterEach, expect, it, vi } from 'vitest'
import { remoteMedia } from './mediaClient'

afterEach(() => vi.unstubAllGlobals())
it('cancels a link check while session setup is pending', async () => {
  const network = vi.fn(() => new Promise<Response>(() => {}))
  vi.stubGlobal('fetch', network)
  const controller = new AbortController()
  const check = remoteMedia.inspect('https://example.com/video', controller.signal)
  controller.abort()
  await expect(check).rejects.toMatchObject({ name: 'AbortError' })
  expect(network).toHaveBeenCalledTimes(1)
})
