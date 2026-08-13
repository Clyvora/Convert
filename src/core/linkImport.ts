const MAX_LINK_FILE_BYTES = 256 * 1024 * 1024
const SOUNDCLOUD_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com', 'snd.sc'])
const SOUNDCLOUD_MEDIA_HOSTS = ['sndcdn.com']
const PRODUCTION_SOUNDCLOUD_RESOLVER = 'https://clyvora-link-resolver.levi-05e.workers.dev/v1/soundcloud/resolve'

export interface LinkImportProgress {
  loaded: number
  total?: number
}

export interface DirectFileImport {
  kind: 'file'
  file: File
}

function parseHttpsUrl(input: string): URL {
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new Error('Enter a complete link beginning with https://') }
  if (url.protocol !== 'https:') throw new Error('Only secure HTTPS links can be imported.')
  if (url.username || url.password) throw new Error('Links containing usernames or passwords are not accepted.')
  return url
}

function sanitizeFilename(raw: string): string {
  let safe = raw.replace(/[<>:"/\\|?*]/g, '_').split('').map((character) => character.charCodeAt(0) < 32 ? '_' : character).join('').slice(0, 180).trim()
  if (!safe) safe = 'linked-media'
  return safe
}

function filenameFromResponse(url: URL, response: Response, preferredName?: string): string {
  const disposition = response.headers.get('content-disposition') ?? ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quoted = disposition.match(/filename="([^"]+)"/i)?.[1]
  const pathName = url.pathname.split('/').filter(Boolean).at(-1)
  const raw = preferredName ?? (encoded ? decodeURIComponent(encoded) : quoted ?? pathName ?? 'linked-media')
  let safe = sanitizeFilename(raw)
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const extension = ({
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
    'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'video/mp4': 'mp4', 'video/webm': 'webm',
  } as Record<string, string>)[contentType]
  if (extension && !safe.toLowerCase().endsWith(`.${extension}`)) safe = `${safe.replace(/\.[^.]+$/, '')}.${extension}`
  return safe
}

async function downloadResponse(
  url: URL,
  response: Response,
  signal: AbortSignal,
  onProgress?: (progress: LinkImportProgress) => void,
  preferredName?: string,
): Promise<File> {
  if (!response.ok) throw new Error(`The linked file could not be fetched (HTTP ${response.status}).`)
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
    throw new Error('This link points to a webpage, not directly to a downloadable media file.')
  }
  const declaredLength = Number(response.headers.get('content-length')) || undefined
  if (declaredLength && declaredLength > MAX_LINK_FILE_BYTES) throw new Error('This linked file is larger than the 256 MB browser import limit.')
  const reader = response.body?.getReader()
  if (!reader) {
    const blob = await response.blob()
    if (blob.size > MAX_LINK_FILE_BYTES) throw new Error('This linked file is larger than the 256 MB browser import limit.')
    return new File([blob], filenameFromResponse(url, response, preferredName), { type: contentType || blob.type })
  }
  const chunks: ArrayBuffer[] = []
  let loaded = 0
  while (true) {
    if (signal.aborted) throw new DOMException('Link import cancelled.', 'AbortError')
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.byteLength
    if (loaded > MAX_LINK_FILE_BYTES) {
      await reader.cancel()
      throw new Error('This linked file is larger than the 256 MB browser import limit.')
    }
    const chunk = new Uint8Array(value.byteLength)
    chunk.set(value)
    chunks.push(chunk.buffer)
    onProgress?.({ loaded, total: declaredLength })
  }
  return new File(chunks, filenameFromResponse(url, response, preferredName), { type: contentType })
}

interface ResolvedSoundCloudMedia {
  kind: 'direct-media'
  mediaUrl: string
  filename: string
  mimeType: string
}

function isSoundCloudTrackUrl(url: URL): boolean {
  return SOUNDCLOUD_HOSTS.has(url.hostname.toLowerCase())
}

function resolverUrl(): string {
  return import.meta.env.VITE_MEDIA_RESOLVER_URL?.trim()
    || (import.meta.env.PROD ? PRODUCTION_SOUNDCLOUD_RESOLVER : '/api/soundcloud/resolve')
}

function isAllowedSoundCloudMediaUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return url.protocol === 'https:' && SOUNDCLOUD_MEDIA_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

async function resolveSoundCloudMedia(url: URL, signal: AbortSignal): Promise<ResolvedSoundCloudMedia> {
  let response: Response
  try {
    response = await fetch(resolverUrl(), {
      method: 'POST',
      signal,
      // text/plain is CORS-safelisted, avoiding a separate preflight round trip to the Worker.
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ url: url.href }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('The SoundCloud link service is unavailable. Try again later.')
  }
  let payload: unknown
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      && typeof payload.error === 'object' && payload.error && 'message' in payload.error
      && typeof payload.error.message === 'string'
      ? payload.error.message
      : 'This SoundCloud link could not be imported.'
    throw new Error(message)
  }
  if (typeof payload !== 'object' || !payload || !('kind' in payload) || payload.kind !== 'direct-media'
    || !('mediaUrl' in payload) || typeof payload.mediaUrl !== 'string'
    || !('filename' in payload) || typeof payload.filename !== 'string'
    || !('mimeType' in payload) || typeof payload.mimeType !== 'string') {
    throw new Error('The SoundCloud link service returned an invalid response.')
  }
  const mediaUrl = new URL(payload.mediaUrl)
  if (!isAllowedSoundCloudMediaUrl(mediaUrl)) throw new Error('The SoundCloud link service returned an unsafe media location.')
  return { kind: 'direct-media', mediaUrl: mediaUrl.href, filename: sanitizeFilename(payload.filename), mimeType: payload.mimeType }
}

export async function importMediaLink(
  input: string,
  signal: AbortSignal,
  onProgress?: (progress: LinkImportProgress) => void,
): Promise<DirectFileImport> {
  const url = parseHttpsUrl(input)
  let preferredName: string | undefined
  let downloadUrl = url
  if (isSoundCloudTrackUrl(url)) {
    const resolved = await resolveSoundCloudMedia(url, signal)
    downloadUrl = new URL(resolved.mediaUrl)
    preferredName = resolved.filename
  }
  let response: Response
  try {
    response = await fetch(downloadUrl, { signal, redirect: 'follow' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('This website did not allow Clyvora to fetch that link. Try a direct media URL or download the file first.')
  }
  return { kind: 'file', file: await downloadResponse(downloadUrl, response, signal, onProgress, preferredName) }
}
