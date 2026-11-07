import { afterEach, expect, it, vi } from 'vitest'
import { browserMediaURL, downloadInBrowser, playlistParts } from './browserDownload'
import type { BrowserPlan } from './remoteContracts'

const root = 'https://playback.media-streaming.soundcloud.cloud/audio/manifest.m3u8?token=test'
const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:1,\none.m4s\n#EXTINF:1,\ntwo.m4s\n#EXT-X-ENDLIST'
const plan: BrowserPlan = { url: root, filename: 'test.m4a', mime: 'audio/mp4', maxBytes: 1024, expires: Date.now() + 60000 }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('assembles fMP4 in playlist order despite out-of-order fetch completion', async () => {
  const calls: RequestInit[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    calls.push(options)
    if (url === root) return new Response(playlist)
    if (url.endsWith('/init.mp4')) { await new Promise(resolve => setTimeout(resolve, 10)); return new Response('0000ftypINIT') }
    return new Response(url.endsWith('/one.m4s') ? 'FIRST' : 'SECOND')
  }))
  const progress = vi.fn()
  const blob = await downloadInBrowser(plan, new AbortController().signal, progress)
  // jsdom's Blob lacks text(); use the standard FileReader implementation.
  const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob) })
  expect(text).toBe('0000ftypINITFIRSTSECOND')
  expect(progress).toHaveBeenCalled()
  expect(calls.every(c => c.credentials === 'omit' && c.cache === 'no-store' && c.redirect === 'error' && c.referrerPolicy === 'no-referrer')).toBe(true)
})

it.each([
  playlist.replace('#EXT-X-ENDLIST', ''),
  playlist + '\n#EXT-X-KEY:METHOD=AES-128,URI="key"',
  playlist + '\n#EXT-X-BYTERANGE:10@0',
  playlist + '\n#EXT-X-DISCONTINUITY',
  playlist.replace('one.m4s', 'https://evil.example/audio'),
  playlist.replace('one.m4s', 'https://user:password@playback.media-streaming.soundcloud.cloud/audio'),
])('rejects unsupported or unsafe playlists before downloading parts: %s', text => {
  expect(() => playlistParts(text, root)).toThrow()
})

it('rejects lookalike hosts and non-HTTPS targets', () => {
  for (const value of ['http://playback.media-streaming.soundcloud.cloud/a', 'https://playback.media-streaming.soundcloud.cloud.evil.example/a', 'https://127.0.0.1/a']) expect(() => browserMediaURL(value)).toThrow()
})

it('enforces cumulative byte caps even if a source omits content-length', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url === root ? playlist : '0000ftypOVERLIMIT')))
  await expect(downloadInBrowser({ ...plan, maxBytes: 10 }, new AbortController().signal, vi.fn())).rejects.toThrow('size limit')
})

it('rejects expired plans without making a request', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  await expect(downloadInBrowser({ ...plan, expires: 0 }, new AbortController().signal, vi.fn())).rejects.toThrow('expired')
  expect(fetcher).not.toHaveBeenCalled()
})

it('keeps a slow file on the browser path while bytes continue arriving', async () => {
  vi.useFakeTimers()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('Timed out.', 'TimeoutError')), ms)
    return controller.signal
  })
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => new Response(new ReadableStream({
    start(controller) {
      let chunks = 0
      const timer = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(chunks++ === 0 ? '0000ftyp' : 'DATA'))
        if (chunks === 8) { clearInterval(timer); controller.close() }
      }, 5000)
      options.signal?.addEventListener('abort', () => { clearInterval(timer); controller.error(options.signal?.reason) }, { once: true })
    },
  }))))
  const result = downloadInBrowser({ ...plan, url: 'https://video.twimg.com/clip.mp4', mode: 'combined', container: 'mp4', mime: 'video/mp4', streams: [{ url: 'https://video.twimg.com/clip.mp4', protocol: 'file', role: 'combined', ext: 'mp4' }] }, new AbortController().signal, vi.fn())
  const completed = expect(result).resolves.toHaveProperty('size', 36)
  await vi.advanceTimersByTimeAsync(40000)
  await completed
})

it('stops a stalled source after fifteen seconds without incoming data', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('0000ftyp'))
      options.signal?.addEventListener('abort', () => controller.error(options.signal?.reason), { once: true })
    },
  }))))
  const result = downloadInBrowser({ ...plan, streams: [{ url: root, protocol: 'file', role: 'audio', ext: 'm4a' }] }, new AbortController().signal, vi.fn())
  const failed = expect(result).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(15001)
  await failed
})
