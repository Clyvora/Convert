import { describe, expect, it, vi } from 'vitest'

import { importMediaLink } from './linkImport'

describe('browser link importing', () => {
  it('rejects insecure and credential-bearing URLs before making a request', async () => {
    const request = vi.spyOn(globalThis, 'fetch')
    await expect(importMediaLink('http://example.com/file.mp3', new AbortController().signal)).rejects.toThrow(/HTTPS/i)
    await expect(importMediaLink('https://user:secret@example.com/file.mp3', new AbortController().signal)).rejects.toThrow(/passwords/i)
    expect(request).not.toHaveBeenCalled()
    request.mockRestore()
  })

  it('imports a CORS-enabled direct media response as a browser File', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(new Uint8Array([0x49, 0x44, 0x33, 4]), {
      headers: { 'content-type': 'audio/mpeg', 'content-disposition': 'attachment; filename="demo.mp3"' },
    }))
    const result = await importMediaLink('https://media.example/download', new AbortController().signal)
    expect(result.kind).toBe('file')
    if (result.kind === 'file') {
      expect(result.file.name).toBe('demo.mp3')
      expect(result.file.type).toBe('audio/mpeg')
    }
  })

  it('rejects ordinary webpages instead of placing HTML in the media queue', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }))
    await expect(importMediaLink('https://example.com/watch/123', new AbortController().signal)).rejects.toThrow(/webpage/i)
  })

  it('resolves a public SoundCloud track before downloading from its CDN', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        kind: 'direct-media',
        mediaUrl: 'https://cf-media.sndcdn.com/example.mp3?Policy=signed',
        filename: 'Artist - Track.mp3',
        mimeType: 'audio/mpeg',
      }), { headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0x49, 0x44, 0x33, 4]), {
        headers: { 'content-type': 'audio/mpeg' },
      }))

    const result = await importMediaLink('https://soundcloud.com/artist/track', new AbortController().signal)
    expect(result.file.name).toBe('Artist - Track.mp3')
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/soundcloud/resolve', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ hostname: 'cf-media.sndcdn.com' }), expect.objectContaining({ redirect: 'follow' }))
  })

  it('sends SoundCloud share links through the resolver', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        kind: 'direct-media',
        mediaUrl: 'https://cf-media.sndcdn.com/shared.mp3?Policy=signed',
        filename: 'Shared Track.mp3',
        mimeType: 'audio/mpeg',
      }), { headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0x49, 0x44, 0x33, 4]), {
        headers: { 'content-type': 'audio/mpeg' },
      }))

    const result = await importMediaLink('https://on.soundcloud.com/share123', new AbortController().signal)
    expect(result.file.name).toBe('Shared Track.mp3')
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/soundcloud/resolve', expect.objectContaining({ method: 'POST' }))
  })

  it('surfaces the resolver explanation for an unsupported protected stream', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'NO_SUPPORTED_STREAM', message: 'This track is only available through a protected or unsupported stream.' },
    }), { status: 422, headers: { 'content-type': 'application/json' } }))
    await expect(importMediaLink('https://soundcloud.com/artist/track', new AbortController().signal)).rejects.toThrow(/protected or unsupported/i)
  })

  it('rejects a compromised resolver response pointing outside SoundCloud media hosts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      kind: 'direct-media', mediaUrl: 'https://attacker.example/file.mp3', filename: 'track.mp3', mimeType: 'audio/mpeg',
    }), { headers: { 'content-type': 'application/json' } }))
    await expect(importMediaLink('https://soundcloud.com/artist/track', new AbortController().signal)).rejects.toThrow(/unsafe media/i)
  })
})
