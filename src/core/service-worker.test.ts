/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it.each(['open', 'put', 'match'])('serves a successful asset when cache %s fails', async (operation) => {
  const handlers: Record<string, (event: unknown) => void> = {}
  const response = { ok: true, type: 'basic', clone: () => ({}) }
  const fail = () => { throw new Error('QuotaExceededError') }
  const cache = { put: operation === 'put' ? fail : vi.fn() }
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL, fetch: async () => response,
    caches: { open: async () => operation === 'open' ? fail() : cache, match: async () => operation === 'match' ? fail() : undefined },
    self: { location: { origin: 'https://convert.example' }, addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler } },
  })
  let result: Promise<unknown> | undefined
  handlers.fetch({ request: { method: 'GET', url: 'https://convert.example/assets/app.js' }, respondWith: (promise: Promise<unknown>) => { result = promise } })
  await expect(result).resolves.toBe(response)
})

it('never intercepts or caches retrieved media and API requests', () => {
  const handlers: Record<string, (event: unknown) => void> = {}
  const network = vi.fn()
  const open = vi.fn()
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL, fetch: network, caches: { open },
    self: { location: { origin: 'https://convert.example' }, addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler } },
  })
  for (const path of ['/api', '/api/v1/convert/media/download/0123456789abcdef0123456789abcdef', '/api/v1/convert/jobs', '/v1/convert/artifacts/id/preview', '/artifacts/id?signature=secret']) {
    const respondWith = vi.fn()
    handlers.fetch({ request: { method: 'GET', url: `https://convert.example${path}` }, respondWith })
    expect(respondWith).not.toHaveBeenCalled()
  }
  expect(open).not.toHaveBeenCalled()
  expect(network).not.toHaveBeenCalled()
})
