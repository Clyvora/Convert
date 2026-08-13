const SOUNDCLOUD_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'])
const SOUNDCLOUD_SHORT_HOSTS = new Set(['on.soundcloud.com', 'snd.sc'])
const SOUNDCLOUD_API_HOST = 'api-v2.soundcloud.com'
const MAX_REQUEST_BYTES = 4 * 1024
const MAX_PAGE_BYTES = 1024 * 1024
const MAX_ASSET_BYTES = 3 * 1024 * 1024
const MAX_ASSETS_TO_CHECK = 12
const MAX_REDIRECTS = 5
const CLIENT_ID_PATTERN = /client_id[=:]"([A-Za-z0-9]{32})"/

function json(body, status, origin = null, extraHeaders = {}) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  })
  if (origin) {
    headers.set('access-control-allow-origin', origin)
    headers.set('vary', 'Origin')
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function fail(code, message, status, origin = null, extraHeaders = {}) {
  return json({ error: { code, message } }, status, origin, extraHeaders)
}

function configuredOrigins(env) {
  return new Set((env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean))
}

function acceptedOrigin(request, env) {
  const origin = request.headers.get('origin')
  if (!origin) return null
  if (origin === new URL(request.url).origin) return origin
  return configuredOrigins(env).has(origin) ? origin : false
}

function parseSoundCloudUrl(input) {
  let url
  try { url = new URL(input) } catch { throw new Error('Paste a complete SoundCloud track link.') }
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || (!SOUNDCLOUD_HOSTS.has(hostname) && !SOUNDCLOUD_SHORT_HOSTS.has(hostname))) {
    throw new Error('Only public soundcloud.com track links are supported.')
  }
  if (url.username || url.password || url.searchParams.has('secret_token')) {
    throw new Error('Credential-bearing SoundCloud links are not accepted.')
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (SOUNDCLOUD_SHORT_HOSTS.has(hostname)) {
    if (parts.length === 0) throw new Error('That SoundCloud share link is incomplete.')
  } else {
    const hasUnlistedAccessKey = parts.length === 3 && /^s-[A-Za-z0-9_-]+$/.test(parts[2])
    if (parts.length !== 2 && !hasUnlistedAccessKey) {
      throw new Error('Paste a link to one SoundCloud track, not a profile, playlist, or search page.')
    }
    url.hostname = 'soundcloud.com'
  }
  url.search = ''
  url.hash = ''
  return url
}

function isSoundCloudPageHost(hostname) {
  const normalized = hostname.toLowerCase()
  return SOUNDCLOUD_HOSTS.has(normalized) || SOUNDCLOUD_SHORT_HOSTS.has(normalized)
}

async function fetchSoundCloudPage(initialUrl, fetchImpl) {
  let currentUrl = initialUrl
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetchImpl(currentUrl, {
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 Clyvora-Link-Resolver/1.1', accept: 'text/html' },
    })
    if (response.status < 300 || response.status >= 400) return { response, url: currentUrl }
    const location = response.headers.get('location')
    if (!location) throw new Error('SoundCloud returned an incomplete redirect.')
    const nextUrl = new URL(location, currentUrl)
    if (nextUrl.protocol !== 'https:' || !isSoundCloudPageHost(nextUrl.hostname) || nextUrl.username || nextUrl.password) {
      throw new Error('SoundCloud redirected outside its website.')
    }
    currentUrl = nextUrl
  }
  throw new Error('That SoundCloud share link redirected too many times.')
}

function canonicalTrackUrl(input) {
  const url = new URL(input)
  if (!SOUNDCLOUD_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('The SoundCloud share link did not resolve to a track.')
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const hasUnlistedAccessKey = parts.length === 3 && /^s-[A-Za-z0-9_-]+$/.test(parts[2])
  if (parts.length !== 2 && !hasUnlistedAccessKey) {
    throw new Error('The SoundCloud link does not point to one track.')
  }
  url.protocol = 'https:'
  url.hostname = 'soundcloud.com'
  url.port = ''
  url.search = ''
  url.hash = ''
  return url
}

async function readLimitedText(response, limit, label) {
  const declared = Number(response.headers.get('content-length')) || 0
  if (declared > limit) throw new Error(`${label} was unexpectedly large.`)
  if (!response.body) return response.text()
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      throw new Error(`${label} was unexpectedly large.`)
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

function hydrationEntries(html) {
  const marker = 'window.__sc_hydration = '
  const start = html.indexOf(marker)
  if (start < 0) return null
  const jsonStart = start + marker.length
  const end = html.indexOf(';</script>', jsonStart)
  if (end < 0) return null
  let hydration
  try { hydration = JSON.parse(html.slice(jsonStart, end)) } catch { return null }
  return Array.isArray(hydration) ? hydration : null
}

function extractTrack(hydration, requestedUrl) {
  if (!hydration) return null
  const sounds = hydration
    .filter((entry) => entry?.hydratable === 'sound' && entry.data?.kind === 'track')
    .map((entry) => entry.data)
  const requestedPath = requestedUrl.pathname.replace(/\/$/, '').toLowerCase()
  return sounds.find((track) => {
    try { return new URL(track.permalink_url).pathname.replace(/\/$/, '').toLowerCase() === requestedPath } catch { return false }
  }) ?? sounds[0] ?? null
}

function extractHydratedClientId(hydration) {
  if (!hydration) return null
  const value = hydration.find((entry) => entry?.hydratable === 'apiClient')?.data?.client_id
  return /^[A-Za-z0-9]{32}$/.test(value ?? '') ? value : null
}

function extractAssetUrls(html) {
  const urls = []
  const pattern = /<script[^>]+src=["']([^"']+)["']/gi
  for (const match of html.matchAll(pattern)) {
    try {
      const url = new URL(match[1], 'https://soundcloud.com')
      if (url.protocol === 'https:' && url.hostname === 'a-v2.sndcdn.com' && url.pathname.endsWith('.js')) urls.push(url.href)
    } catch { /* Ignore malformed asset references. */ }
  }
  return [...new Set(urls)].slice(-MAX_ASSETS_TO_CHECK).reverse()
}

function cacheKey(request) {
  const url = new URL(request.url)
  return new Request(`${url.origin}/__clyvora_internal/soundcloud-client-id`)
}

async function cachedClientId(request, cache) {
  if (!cache) return null
  const response = await cache.match(cacheKey(request))
  if (!response) return null
  const value = await response.text()
  return /^[A-Za-z0-9]{32}$/.test(value) ? value : null
}

async function discoverClientId(html, hydration, request, env, fetchImpl, cache, ignoreCache = false) {
  if (!ignoreCache && /^[A-Za-z0-9]{32}$/.test(env.SOUNDCLOUD_CLIENT_ID ?? '')) return env.SOUNDCLOUD_CLIENT_ID
  if (!ignoreCache) {
    const cached = await cachedClientId(request, cache)
    if (cached) return cached
  }
  const hydrated = extractHydratedClientId(hydration)
  if (hydrated) {
    if (cache) await cache.put(cacheKey(request), new Response(hydrated, {
      headers: { 'cache-control': 'public, max-age=21600' },
    }))
    return hydrated
  }
  for (const assetUrl of extractAssetUrls(html)) {
    const response = await fetchImpl(assetUrl, { headers: { 'user-agent': 'Mozilla/5.0 Clyvora-Link-Resolver/1.1' } })
    if (!response.ok) continue
    const source = await readLimitedText(response, MAX_ASSET_BYTES, 'SoundCloud application asset')
    const match = source.match(CLIENT_ID_PATTERN)
    if (!match) continue
    if (cache) {
      await cache.put(cacheKey(request), new Response(match[1], {
        headers: { 'cache-control': 'public, max-age=21600' },
      }))
    }
    return match[1]
  }
  throw new Error('SoundCloud changed its website and the resolver could not initialize.')
}

function selectPermittedTranscoding(track) {
  const transcodings = Array.isArray(track.media?.transcodings) ? track.media.transcodings : []
  return transcodings.find((entry) =>
    entry?.snipped !== true
    && !String(entry?.format?.protocol ?? '').includes('encrypted')
    && entry?.format?.protocol === 'progressive'
    && entry?.format?.mime_type === 'audio/mpeg'
    && entry?.url,
  ) ?? null
}

function safeFilename(track) {
  const artist = track.publisher_metadata?.artist || track.user?.username || 'SoundCloud'
  const title = track.publisher_metadata?.release_title || track.title || 'track'
  const cleaned = `${artist} - ${title}`
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('').map((character) => character.charCodeAt(0) < 32 ? '_' : character).join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 170)
  return `${cleaned || 'soundcloud-track'}.mp3`
}

function isAllowedMediaUrl(input) {
  try {
    const url = new URL(input)
    return url.protocol === 'https:' && (url.hostname === 'sndcdn.com' || url.hostname.endsWith('.sndcdn.com'))
  } catch { return false }
}

async function resolveTranscoding(transcoding, clientId, trackAuthorization, fetchImpl) {
  const endpoint = new URL(transcoding.url)
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== SOUNDCLOUD_API_HOST || !endpoint.pathname.includes('/stream/progressive')) {
    throw new Error('SoundCloud returned an unexpected media endpoint.')
  }
  endpoint.searchParams.set('client_id', clientId)
  if (trackAuthorization) endpoint.searchParams.set('track_authorization', trackAuthorization)
  const response = await fetchImpl(endpoint, { headers: { 'user-agent': 'Mozilla/5.0 Clyvora-Link-Resolver/1.1' } })
  if (!response.ok) return { ok: false, status: response.status }
  const payload = await response.json()
  if (!isAllowedMediaUrl(payload?.url)) throw new Error('SoundCloud returned an unexpected download location.')
  return { ok: true, url: payload.url }
}

export async function handleRequest(request, env = {}, dependencies = {}) {
  const fetchImpl = dependencies.fetch ?? globalThis.fetch
  const cache = dependencies.cache ?? globalThis.caches?.default ?? null
  const origin = acceptedOrigin(request, env)
  if (origin === false) return fail('ORIGIN_NOT_ALLOWED', 'This website is not allowed to use the resolver.', 403)

  if (request.method === 'OPTIONS') {
    if (!origin) return new Response(null, { status: 204 })
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    } })
  }

  if (!origin) return fail('ORIGIN_REQUIRED', 'A browser origin is required to use the resolver.', 403)

  const path = new URL(request.url).pathname
  if (path !== '/api/soundcloud/resolve' && path !== '/v1/soundcloud/resolve') {
    return fail('NOT_FOUND', 'Resolver route not found.', 404, origin)
  }
  if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'Use POST for this endpoint.', 405, origin, { allow: 'POST, OPTIONS' })
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return fail('INVALID_REQUEST', 'Send a JSON request.', 415, origin)
  }
  if ((Number(request.headers.get('content-length')) || 0) > MAX_REQUEST_BYTES) {
    return fail('INVALID_REQUEST', 'The request is too large.', 413, origin)
  }

  if (env.LINK_RATE_LIMITER) {
    const actor = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const rate = await env.LINK_RATE_LIMITER.limit({ key: actor })
    if (!rate.success) return fail('RATE_LIMITED', 'Too many link checks. Wait a minute and try again.', 429, origin, { 'retry-after': '60' })
  }

  let body
  try { body = await request.json() } catch { return fail('INVALID_REQUEST', 'The JSON request is invalid.', 400, origin) }
  let trackUrl
  try { trackUrl = parseSoundCloudUrl(body?.url) } catch (error) {
    return fail('INVALID_URL', error instanceof Error ? error.message : 'Invalid SoundCloud link.', 400, origin)
  }

  try {
    const pageResult = await fetchSoundCloudPage(trackUrl, fetchImpl)
    const pageResponse = pageResult.response
    if (!pageResponse.ok) return fail('TRACK_NOT_FOUND', 'That public SoundCloud track could not be opened.', 404, origin)
    const finalUrl = canonicalTrackUrl(pageResult.url)
    const html = await readLimitedText(pageResponse, MAX_PAGE_BYTES, 'SoundCloud page')
    const hydration = hydrationEntries(html)
    const track = extractTrack(hydration, finalUrl)
    if (!track) return fail('TRACK_NOT_FOUND', 'No public track was found at that SoundCloud link.', 404, origin)
    if (track.policy === 'BLOCK') return fail('REGION_RESTRICTED', 'This track is not available in the resolver region.', 451, origin)
    if (track.policy === 'SNIP') return fail('SUBSCRIPTION_REQUIRED', 'This track is only available as a protected SoundCloud preview.', 422, origin)
    if (track.downloadable !== true || track.has_downloads_left === false) {
      return fail('DOWNLOAD_NOT_PERMITTED', 'The uploader has not enabled downloads for this track.', 422, origin)
    }
    const transcoding = selectPermittedTranscoding(track)
    if (!transcoding) {
      return fail('NO_SUPPORTED_STREAM', 'This downloadable track is only available through a protected or unsupported stream.', 422, origin)
    }

    let clientId = await discoverClientId(html, hydration, request, env, fetchImpl, cache)
    let media = await resolveTranscoding(transcoding, clientId, track.track_authorization, fetchImpl)
    if (!media.ok && media.status >= 400 && media.status < 500) {
      if (cache) await cache.delete(cacheKey(request))
      clientId = await discoverClientId(html, hydration, request, { ...env, SOUNDCLOUD_CLIENT_ID: '' }, fetchImpl, cache, true)
      media = await resolveTranscoding(transcoding, clientId, track.track_authorization, fetchImpl)
    }
    if (!media.ok) throw new Error(`SoundCloud rejected the media request (HTTP ${media.status}).`)

    return json({
      kind: 'direct-media',
      mediaUrl: media.url,
      filename: safeFilename(track),
      mimeType: 'audio/mpeg',
      title: track.title ?? null,
      artist: track.publisher_metadata?.artist || track.user?.username || null,
      artworkUrl: track.artwork_url ?? track.user?.avatar_url ?? null,
      sourceUrl: track.permalink_url ?? finalUrl.href,
    }, 200, origin)
  } catch (error) {
    console.error('SoundCloud resolver failed', error instanceof Error ? error.message : error)
    return fail('UPSTREAM_ERROR', 'SoundCloud could not be reached or changed how this link works. Try again later.', 502, origin)
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env)
  },
}
