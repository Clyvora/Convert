import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it('does not silently run a video-only scan when the backend does not support Tools',async()=>{
 const network=vi.fn().mockResolvedValueOnce(Response.json({csrf:'csrf'})).mockResolvedValueOnce(Response.json({error:{code:'NOT_FOUND',message:'Unknown endpoint.',retryable:false}},{status:404}))
 vi.stubGlobal('fetch',network)
 const {remoteMedia}=await import('./mediaClient')
 await expect(remoteMedia.discoverTool({tool:'instagram-post',url:'https://www.instagram.com/p/example/',limit:1})).rejects.toMatchObject({code:'TOOLS_UNAVAILABLE'})
 expect(network.mock.calls[1][0]).toBe('/api/v1/convert/tools/discoveries')
 expect(network).toHaveBeenCalledTimes(2)
})

it('reports an unavailable service instead of exposing a gateway HTML parsing error', async () => {
  const network = vi.fn().mockResolvedValueOnce(new Response('<html>Bad Gateway</html>', { status: 502 }))
  vi.stubGlobal('fetch', network)
  const { remoteMedia } = await import('./mediaClient')
  await expect(remoteMedia.inspect('https://example.com/video')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
  expect(network).toHaveBeenCalledOnce()
  network.mockResolvedValueOnce(Response.json({ csrf: 'csrf' })).mockResolvedValueOnce(Response.json({ engine: 'ready' }))
  await expect(remoteMedia.capabilities()).resolves.toMatchObject({ engine: 'ready' })
  expect(network).toHaveBeenCalledTimes(3)
})

it('handles an empty API error after successful session setup', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ csrf: 'csrf' })).mockResolvedValueOnce(new Response('', { status: 503 })))
  const { remoteMedia } = await import('./mediaClient')
  await expect(remoteMedia.inspect('https://example.com/video')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
})

it.each(['null', '[]', 'not json'])('rejects an invalid successful response: %s', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ csrf: 'csrf' })).mockResolvedValueOnce(new Response(body)))
  const { remoteMedia } = await import('./mediaClient')
  await expect(remoteMedia.capabilities()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', retryable: false })
})

it('preserves rate limits and their retry delay when the source returns an HTML error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('<html>Too many requests</html>', { status: 429, headers: { 'retry-after': '30' } })))
  const { remoteMedia } = await import('./mediaClient')
  await expect(remoteMedia.capabilities()).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: true, retryAfter: 30 })
})

it('preserves the access-required message from a structured service response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ csrf: 'csrf' })).mockResolvedValueOnce(Response.json({ error: { code: 'ACCESS_REQUIRED', message: 'This video requires sign-in.', retryable: false } }, { status: 502 })))
  const { remoteMedia } = await import('./mediaClient')
  await expect(remoteMedia.inspect('https://example.com/video')).rejects.toMatchObject({ code: 'ACCESS_REQUIRED', message: 'This video requires sign-in.', retryable: false })
})

it('starts a new session after a non-JSON unauthorized response', async () => {
  const network = vi.fn().mockResolvedValueOnce(Response.json({ csrf: 'old' })).mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(Response.json({ csrf: 'new' })).mockResolvedValueOnce(Response.json({ engine: 'ready' }))
  vi.stubGlobal('fetch', network)
  const { remoteMedia } = await import('./mediaClient')
  await expect(remoteMedia.capabilities()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
  await expect(remoteMedia.capabilities()).resolves.toMatchObject({ engine: 'ready' })
  expect(network).toHaveBeenCalledTimes(4)
})

it('preserves cancellation while reading the response body', async () => {
  const response = new Response('{}')
  vi.spyOn(response, 'json').mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response))
  const { remoteMedia } = await import('./mediaClient')
  await expect(remoteMedia.capabilities()).rejects.toMatchObject({ name: 'AbortError' })
})
