import type { BrowserPlan, BrowserStream } from './remoteContracts'

const HOST = 'playback.media-streaming.soundcloud.cloud'
function family(host: string) { return host === HOST ? 'soundcloud' : host === 'video.twimg.com' ? 'twitter' : host.endsWith('.fbcdn.net') ? 'facebook' : host.endsWith('.cdninstagram.com') ? 'instagram' : null }
export function browserMediaURL(raw: string, base?: string): string {
  const url = new URL(raw, base)
  const provider = family(url.hostname)
  if (url.protocol !== 'https:' || !provider || url.port || url.username || url.password || url.hash || base && provider !== family(new URL(base).hostname)) throw new Error('Unsupported browser media location.')
  return url.href
}

export function playlistParts(text: string, base: string): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines[0] !== '#EXTM3U' || !lines.includes('#EXT-X-ENDLIST')) throw new Error('A complete media playlist is required.')
  if (lines.some(line => /^#EXT-X-(BYTERANGE|DISCONTINUITY|STREAM-INF|I-FRAMES-ONLY|GAP|PART|SKIP)/.test(line)
    || line.startsWith('#EXT-X-KEY:') && !/^#EXT-X-KEY:METHOD=NONE(?:,|$)/.test(line))) throw new Error('This playlist needs the standard download path.')
  const maps = lines.filter(line => line.startsWith('#EXT-X-MAP:'))
  const init = maps[0]?.match(/^#EXT-X-MAP:URI="([^"]+)"$/)
  const segments = lines.filter(line => !line.startsWith('#'))
  if (maps.length > 1 || maps.length === 1 && !init || new URL(base).hostname === HOST && !init || !segments.length || segments.length > 256 || lines.filter(line => line.startsWith('#EXTINF:')).length !== segments.length) throw new Error('Unsupported media playlist layout.')
  return [...(init ? [init[1]] : []), ...segments].map(raw => browserMediaURL(raw, base))
}

export async function downloadInBrowser(plan: BrowserPlan, cancellation: AbortSignal, progress: (bytes: number, speed: number, processing?: boolean) => void): Promise<Blob> {
  if (plan.expires <= Date.now() || !['audio/mp4', 'video/mp4', 'video/x-matroska', 'video/webm', 'audio/ogg'].includes(plan.mime) || !Number.isSafeInteger(plan.maxBytes) || plan.maxBytes < 1 || plan.maxBytes > 64 * 1024 ** 2) throw new Error('Browser download expired or exceeds the local limit.')
  const group = new AbortController()
  const signal = AbortSignal.any([cancellation, group.signal, AbortSignal.timeout(150_000)])
  const started = performance.now()
  let received = 0, lastUpdate = 0
  async function read(url: string, limit: number, count = true): Promise<Uint8Array<ArrayBuffer>> {
    const idle = new AbortController()
    const requestSignal = AbortSignal.any([signal, idle.signal])
    let timer: ReturnType<typeof setTimeout>, reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    const resetIdle = () => {
      clearTimeout(timer)
      timer = setTimeout(() => idle.abort(new DOMException('The source stopped sending data.', 'TimeoutError')), 15_000)
    }
    resetIdle()
    try {
      const response = await fetch(browserMediaURL(url), { signal: requestSignal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' })
      if (!response.ok || !response.body) throw new Error('The source did not permit browser downloading.')
      reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        requestSignal.throwIfAborted()
        if (done) break
        if (value.byteLength) resetIdle()
        size += value.byteLength
        if (count) received += value.byteLength
        if (size > limit || received > plan.maxBytes) throw new Error('Browser download size limit reached.')
        chunks.push(value)
        const now = performance.now()
        if (count && now - lastUpdate > 100) { lastUpdate = now; progress(received, received * 1000 / Math.max(1, now - started)) }
      }
      if (!size) throw new Error('The source returned an empty media part.')
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      return bytes
    } finally {
      clearTimeout(timer!)
      if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock() }
    }
  }
  try {
    const streams: BrowserStream[] = plan.streams || [{ url: plan.url, protocol: 'hls', role: 'audio', ext: 'm4a' }]
    if (!streams.length || streams.length > 2) throw new Error('Unsupported stream selection.')
    const inputs: { stream: BrowserStream; blob: Blob; ext: string }[] = []
    for (const stream of streams) {
      browserMediaURL(stream.url, plan.url)
      if (!['audio', 'video', 'combined'].includes(stream.role) || !/^[a-z0-9]{1,10}$/.test(stream.ext)) throw new Error('Invalid stream metadata.')
      if (stream.protocol === 'file') {
        const data = await read(stream.url, plan.maxBytes)
        if (['mp4', 'm4a'].includes(stream.ext) && new TextDecoder().decode(data.slice(4, 8)) !== 'ftyp') throw new Error('The source returned an unexpected media file.')
        inputs.push({ stream, blob: new Blob([data], { type: plan.mime }), ext: stream.ext })
        continue
      }
      if (stream.protocol !== 'hls') throw new Error('Unsupported media protocol.')
      const manifest = new TextDecoder().decode(await read(stream.url, 256 * 1024, false))
      const fragmented = manifest.includes('#EXT-X-MAP:')
      const urls = playlistParts(manifest, stream.url)
      const parts: Uint8Array<ArrayBuffer>[] = new Array(urls.length)
      let next = 0
      await Promise.all([0, 1].map(async () => {
        while (next < urls.length) {
          signal.throwIfAborted()
          const index = next++
          parts[index] = await read(urls[index], 8 * 1024 ** 2)
        }
      }))
      if (fragmented && new TextDecoder().decode(parts[0].slice(4, 8)) !== 'ftyp') throw new Error('Unexpected media initialization.')
      inputs.push({ stream, blob: new Blob(parts, { type: plan.mime }), ext: fragmented ? stream.ext : 'ts' })
    }
    signal.throwIfAborted()
    progress(received, received * 1000 / Math.max(1, performance.now() - started))
    const mode = plan.mode || 'audio', container = plan.container || 'm4a'
    if (inputs.length === 1 && inputs[0].ext === container && inputs[0].stream.role === mode) return inputs[0].blob
    progress(received, 0, true)
    const { muxBrowserMedia } = await import('./browserMux')
    return await muxBrowserMedia(inputs, plan, signal)
  } finally { group.abort() }
}
