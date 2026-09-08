const SOUNDCLOUD_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'])
const SHORT_HOSTS = new Set(['on.soundcloud.com', 'snd.sc'])
const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 25_000

export interface ResolvedMedia {
  kind: 'direct-media'
  mediaUrl: string
  filename: string
  mimeType: string
  title: string | null
  artist: string | null
  artworkUrl: string | null
  durationSeconds: number | null
  sourceUrl: string
}

export class FetchError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'FetchError'
  }
}

export function validatePublicUrl(input: string): URL {
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new FetchError('INVALID_URL', 'Paste a complete public link beginning with https://.') }
  if (url.protocol !== 'https:') throw new FetchError('UNSUPPORTED_PROTOCOL', 'Only secure HTTPS links are supported.')
  if (url.username || url.password) throw new FetchError('EMBEDDED_CREDENTIALS', 'Links containing usernames or passwords are not accepted.')
  if (url.searchParams.has('secret_token')) throw new FetchError('PRIVATE_LINK', 'Private or token-bearing links are not supported.')
  const host = url.hostname.toLowerCase()
  if (!SOUNDCLOUD_HOSTS.has(host) && !SHORT_HOSTS.has(host)) throw new FetchError('UNSUPPORTED_SITE', 'This website is not supported yet. Clyvora Fetch currently supports public SoundCloud track links.')
  const parts = url.pathname.split('/').filter(Boolean)
  if (SOUNDCLOUD_HOSTS.has(host) && parts.length !== 2) throw new FetchError('NOT_PUBLIC_TRACK', 'Paste one public SoundCloud track link, not a profile, playlist, search page, or private link.')
  if (SHORT_HOSTS.has(host) && parts.length === 0) throw new FetchError('INVALID_URL', 'That share link is incomplete.')
  return url
}

export function apiBase(): string {
  const base = import.meta.env.VITE_CLYVORA_API_BASE_URL?.trim().replace(/\/$/, '') || '/api'
  if (base.startsWith('/') && !base.startsWith('//')) return base
  const url = new URL(base)
  if (url.username || url.password || (import.meta.env.PROD && url.protocol !== 'https:')) throw new FetchError('API_CONFIGURATION', 'The retrieval API address is not configured safely.')
  return base
}

function endpoint(): string {
  return import.meta.env.VITE_CLYVORA_API_URL?.trim() || `${apiBase()}/v1/convert/media/resolve`
}

function downloadUrl(value: string): string {
  if (/^\/v1\/convert\/media\/download\/[\w-]{32}$/.test(value)) return `${apiBase()}${value}`
  // Compatibility with the original metadata-only resolver contract.
  if (isSndCdnUrl(value)) return value
  throw new FetchError('UNSAFE_MEDIA_URL', 'The resolver returned an unsupported download location.')
}

function isSndCdnUrl(input: string): boolean {
  try {
    const url = new URL(input)
    return url.protocol === 'https:' && (url.hostname === 'sndcdn.com' || url.hostname.endsWith('.sndcdn.com'))
  } catch { return false }
}

function safePayload(value: unknown): value is ResolvedMedia {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ResolvedMedia>
  return candidate.kind === 'direct-media' && typeof candidate.mediaUrl === 'string' && (isSndCdnUrl(candidate.mediaUrl) || /^\/v1\/convert\/media\/download\/[\w-]{32}$/.test(candidate.mediaUrl))
    && typeof candidate.filename === 'string' && typeof candidate.mimeType === 'string'
    && (candidate.title === null || typeof candidate.title === 'string')
    && (candidate.artist === null || typeof candidate.artist === 'string')
    && (candidate.artworkUrl === null || (typeof candidate.artworkUrl === 'string' && isSndCdnUrl(candidate.artworkUrl)))
    && (candidate.durationSeconds === null || typeof candidate.durationSeconds === 'number')
    && typeof candidate.sourceUrl === 'string'
}

export async function resolveMedia(input: string, signal?: AbortSignal): Promise<ResolvedMedia> {
  const url = validatePublicUrl(input)
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetch(endpoint(), {
      method: 'POST', signal: combined, headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ url: url.href }),
    })
  } catch {
    if (signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError')
    if (timeout.aborted) throw new FetchError('TIMEOUT', 'The resolver took too long to respond. Try again later.')
    throw new FetchError('RESOLVER_UNAVAILABLE', 'Clyvora’s link resolver is unavailable. Try again later.')
  }
  let payload: unknown = null
  try { payload = await response.json() } catch { /* Invalid upstream response. */ }
  if (signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError')
  if (timeout.aborted) throw new FetchError('TIMEOUT', 'The resolver took too long to respond. Try again later.')
  if (!response.ok) {
    const code = typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'object' && payload.error && 'code' in payload.error && typeof payload.error.code === 'string' ? payload.error.code : 'RESOLVER_ERROR'
    const serverMessage = typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'object' && payload.error && 'message' in payload.error && typeof payload.error.message === 'string' ? payload.error.message : null
    const message = code === 'RATE_LIMITED' ? 'Too many link checks. Wait a minute and try again.'
      : code === 'TRACK_NOT_FOUND' ? 'That public track is unavailable, deleted, or no longer accessible.'
        : code === 'REGION_RESTRICTED' ? 'That track is not available in the resolver region.'
          : code === 'SUBSCRIPTION_REQUIRED' || code === 'NO_SUPPORTED_STREAM' ? 'That track does not provide a supported public downloadable stream.'
            : code === 'RESOLVER_TIMEOUT' ? 'The source platform took too long to respond. Try again later.'
              : serverMessage ?? 'The source platform changed or the resolver could not complete this request.'
    throw new FetchError(code, message)
  }
  if (!safePayload(payload)) throw new FetchError('INVALID_RESPONSE', 'The resolver returned an unsafe or incomplete result.')
  return payload
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').split('').map((character) => character.charCodeAt(0) < 32 ? '_' : character).join('').trim().slice(0, 180) || 'public-audio.mp3'
}

export async function downloadMedia(media: ResolvedMedia, signal: AbortSignal, onProgress?: (loaded: number, total?: number) => void): Promise<{ blob: Blob; filename: string }> {
  const url = downloadUrl(media.mediaUrl)
  const timeout = AbortSignal.timeout(120_000)
  const combined = AbortSignal.any([signal, timeout])
  let response: Response
  try { response = await fetch(url, { signal: combined, redirect: 'error' }) } catch {
    if (signal.aborted) throw new DOMException('Download cancelled.', 'AbortError')
    throw new FetchError('DOWNLOAD_FAILED', 'The source host did not allow the audio download. Try again later.')
  }
  if (!response.ok) throw new FetchError('DOWNLOAD_FAILED', `The source host rejected the download (HTTP ${response.status}).`)
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.toLowerCase()
  if (contentType && !contentType.startsWith('audio/') && contentType !== 'video/mp2t' && contentType !== 'application/octet-stream') { await response.body?.cancel(); throw new FetchError('UNEXPECTED_CONTENT', 'The source returned something other than supported media.') }
  const total = Number(response.headers.get('content-length')) || undefined
  if (total && total > MAX_DOWNLOAD_BYTES) { await response.body?.cancel(); throw new FetchError('TOO_LARGE', 'This audio file exceeds the 256 MB browser download limit.') }
  const reader = response.body?.getReader()
  if (!reader) {
    const blob = await response.blob()
    combined.throwIfAborted()
    if (blob.size > MAX_DOWNLOAD_BYTES) throw new FetchError('TOO_LARGE', 'This audio file exceeds the 256 MB browser download limit.')
    return { blob, filename: sanitizeFilename(media.filename) }
  }
  const chunks: ArrayBuffer[] = []
  let loaded = 0
  try { while (true) {
    combined.throwIfAborted()
    const { done, value } = await reader.read()
    combined.throwIfAborted()
    if (done) break
    loaded += value.byteLength
    if (loaded > MAX_DOWNLOAD_BYTES) { await reader.cancel(); throw new FetchError('TOO_LARGE', 'This audio file exceeds the 256 MB browser download limit.') }
    const chunk = new Uint8Array(value.byteLength)
    chunk.set(value)
    chunks.push(chunk.buffer)
    onProgress?.(loaded, total)
  } } catch (error) { await reader.cancel().catch(() => {}); throw error }
  finally { reader.releaseLock() }
  if (!loaded || (total && loaded !== total)) throw new FetchError('INCOMPLETE_DOWNLOAD', 'The media download was incomplete. Retrieve the link again.')
  return { blob: new Blob(chunks, { type: contentType || media.mimeType }), filename: sanitizeFilename(media.filename) }
}
