import { describe, expect, it, vi } from 'vitest'

import { handleRequest } from './soundcloud-resolver.mjs'

const CLIENT_ID = '12345678901234567890123456789012'
const TRACK_URL = 'https://soundcloud.com/artist/allowed-track'
const TRANSCODING_URL = 'https://api-v2.soundcloud.com/media/soundcloud:tracks:123/example/stream/progressive'
const MEDIA_URL = 'https://cf-media.sndcdn.com/example.128.mp3?Policy=signed'

function page(downloadable = true, overrides: Record<string, unknown> = {}, clientId?: string): string {
  const hydration = [{ hydratable: 'sound', data: {
    kind: 'track', id: 123, title: 'Allowed Track', permalink_url: TRACK_URL,
    downloadable, has_downloads_left: downloadable, artwork_url: null,
    user: { username: 'Artist', avatar_url: null }, publisher_metadata: { artist: 'Artist' },
    media: { transcodings: [{
      url: TRANSCODING_URL, preset: 'mp3_1_0', snipped: false,
      format: { protocol: 'progressive', mime_type: 'audio/mpeg' },
    }] },
    ...overrides,
  } }, ...(clientId ? [{ hydratable: 'apiClient', data: { client_id: clientId } }] : [])]
  return `<html><script src="https://a-v2.sndcdn.com/assets/app.js"></script><script>window.__sc_hydration = ${JSON.stringify(hydration)};</script></html>`
}

function request(url = TRACK_URL, origin = 'https://convert.example', contentType = 'application/json'): Request {
  return new Request('https://resolver.example/v1/soundcloud/resolve', {
    method: 'POST',
    headers: { 'content-type': contentType, origin },
    body: JSON.stringify({ url }),
  })
}

function emptyCache() {
  return {
    match: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
  }
}

describe('SoundCloud resolver Worker', () => {
  it('rejects callers outside the explicit origin allowlist', async () => {
    const response = await handleRequest(request(TRACK_URL, 'https://attacker.example'), {
      ALLOWED_ORIGINS: 'https://convert.example',
    }, { fetch: vi.fn(), cache: emptyCache() })
    expect(response.status).toBe(403)
  })

  it('rejects server-side callers that omit the browser origin', async () => {
    const noOrigin = new Request('https://resolver.example/v1/soundcloud/resolve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: TRACK_URL }),
    })
    const response = await handleRequest(noOrigin, { ALLOWED_ORIGINS: 'https://convert.example' }, {
      fetch: vi.fn(), cache: emptyCache(),
    })
    expect(response.status).toBe(403)
  })

  it('rejects arbitrary URLs before making an upstream request', async () => {
    const fetchMock = vi.fn()
    const response = await handleRequest(request('https://example.com/private'), {
      ALLOWED_ORIGINS: 'https://convert.example',
    }, { fetch: fetchMock, cache: emptyCache() })
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts the browser simple-request content type without a preflight', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === TRACK_URL) return new Response(page(true, {}, CLIENT_ID), { headers: { 'content-type': 'text/html' } })
      if (url.startsWith(TRANSCODING_URL)) return new Response(JSON.stringify({ url: MEDIA_URL }), {
        headers: { 'content-type': 'application/json' },
      })
      throw new Error(`Unexpected fetch: ${url}`)
    })
    const response = await handleRequest(request(TRACK_URL, 'https://convert.example', 'text/plain;charset=UTF-8'), {
      ALLOWED_ORIGINS: 'https://convert.example',
    }, { fetch: fetchMock, cache: emptyCache() })
    expect(response.status).toBe(200)
  })

  it('resolves a public stream even when the uploader disabled SoundCloud downloads', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === TRACK_URL) return new Response(page(false, {}, CLIENT_ID), { headers: { 'content-type': 'text/html' } })
      if (url.startsWith(TRANSCODING_URL)) return new Response(JSON.stringify({ url: MEDIA_URL }), {
        headers: { 'content-type': 'application/json' },
      })
      throw new Error(`Unexpected fetch: ${url}`)
    })
    const response = await handleRequest(request(), { ALLOWED_ORIGINS: 'https://convert.example' }, {
      fetch: fetchMock, cache: emptyCache(),
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ kind: 'direct-media', mediaUrl: MEDIA_URL })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns a direct CDN URL for a public non-encrypted progressive track', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === TRACK_URL) return new Response(page(), { headers: { 'content-type': 'text/html' } })
      if (url === 'https://a-v2.sndcdn.com/assets/app.js') return new Response(`client_id:"${CLIENT_ID}"`)
      if (url.startsWith(TRANSCODING_URL)) return new Response(JSON.stringify({ url: MEDIA_URL }), {
        headers: { 'content-type': 'application/json' },
      })
      throw new Error(`Unexpected fetch: ${url}`)
    })
    const cache = emptyCache()
    const response = await handleRequest(request(), { ALLOWED_ORIGINS: 'https://convert.example' }, { fetch: fetchMock, cache })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      kind: 'direct-media', mediaUrl: MEDIA_URL, filename: 'Artist - Allowed Track.mp3', mimeType: 'audio/mpeg',
    })
    expect(cache.put).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('resolves a SoundCloud share link without following redirects outside SoundCloud', async () => {
    const shareUrl = 'https://on.soundcloud.com/share123'
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === shareUrl) return new Response(null, { status: 302, headers: { location: TRACK_URL } })
      if (url === TRACK_URL) return new Response(page(true, {}, CLIENT_ID), { headers: { 'content-type': 'text/html' } })
      if (url.startsWith(TRANSCODING_URL)) return new Response(JSON.stringify({ url: MEDIA_URL }), {
        headers: { 'content-type': 'application/json' },
      })
      throw new Error(`Unexpected fetch: ${url}`)
    })
    const response = await handleRequest(request(shareUrl), { ALLOWED_ORIGINS: 'https://convert.example' }, {
      fetch: fetchMock, cache: emptyCache(),
    })
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('accepts a complete unlisted link and forwards its track authorization', async () => {
    const unlistedUrl = 'https://soundcloud.com/artist/allowed-track/s-accessKey'
    const authorizedPage = page(true, {
      permalink_url: unlistedUrl,
      track_authorization: 'authorization-token',
    }, CLIENT_ID)
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === unlistedUrl) return new Response(authorizedPage, { headers: { 'content-type': 'text/html' } })
      if (url.startsWith(TRANSCODING_URL)) {
        expect(new URL(url).searchParams.get('track_authorization')).toBe('authorization-token')
        return new Response(JSON.stringify({ url: MEDIA_URL }), { headers: { 'content-type': 'application/json' } })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    const response = await handleRequest(request(unlistedUrl), { ALLOWED_ORIGINS: 'https://convert.example' }, {
      fetch: fetchMock, cache: emptyCache(),
    })
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects paid previews and encrypted streams with a clear explanation', async () => {
    const paidFetch = vi.fn().mockResolvedValue(new Response(page(true, { policy: 'SNIP' }), {
      headers: { 'content-type': 'text/html' },
    }))
    const paidResponse = await handleRequest(request(), { ALLOWED_ORIGINS: 'https://convert.example' }, {
      fetch: paidFetch, cache: emptyCache(),
    })
    expect(paidResponse.status).toBe(422)
    await expect(paidResponse.json()).resolves.toMatchObject({ error: { code: 'SUBSCRIPTION_REQUIRED' } })

    const encryptedFetch = vi.fn().mockResolvedValue(new Response(page(true, { media: { transcodings: [{
      url: TRANSCODING_URL, snipped: false,
      format: { protocol: 'encrypted-hls', mime_type: 'audio/mp4' },
    }] } }), { headers: { 'content-type': 'text/html' } }))
    const encryptedResponse = await handleRequest(request(), { ALLOWED_ORIGINS: 'https://convert.example' }, {
      fetch: encryptedFetch, cache: emptyCache(),
    })
    expect(encryptedResponse.status).toBe(422)
    await expect(encryptedResponse.json()).resolves.toMatchObject({ error: { code: 'NO_SUPPORTED_STREAM' } })
  })

  it('rejects a share-link redirect to a non-SoundCloud host', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 302, headers: { location: 'https://attacker.example/track' },
    }))
    const response = await handleRequest(request('https://on.soundcloud.com/share123'), {
      ALLOWED_ORIGINS: 'https://convert.example',
    }, { fetch: fetchMock, cache: emptyCache() })
    expect(response.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not accept a media URL outside SoundCloud CDN hosts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === TRACK_URL) return new Response(page(), { headers: { 'content-type': 'text/html' } })
      if (url === 'https://a-v2.sndcdn.com/assets/app.js') return new Response(`client_id:"${CLIENT_ID}"`)
      return new Response(JSON.stringify({ url: 'https://attacker.example/audio.mp3' }), {
        headers: { 'content-type': 'application/json' },
      })
    })
    const response = await handleRequest(request(), { ALLOWED_ORIGINS: 'https://convert.example' }, {
      fetch: fetchMock, cache: emptyCache(),
    })
    expect(response.status).toBe(502)
  })
})
