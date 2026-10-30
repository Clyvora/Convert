import { afterEach, expect, it, vi } from 'vitest'
import { batchRequest, splitLinks } from './linkBatch'
afterEach(() => vi.useRealTimers())
it('splits pasted lines and skips duplicate links', () => {
  expect(splitLinks('  https://example.com/a\n\nhttps://example.com/b https://example.com/a  ')).toEqual(['https://example.com/a','https://example.com/b'])
})
it('waits for rate-limit backoff before retrying', async () => {
  vi.useFakeTimers()
  const work = vi.fn().mockRejectedValueOnce({ code: 'RATE_LIMITED', retryAfter: 2 }).mockResolvedValue('ok')
  const waiting = vi.fn()
  const result = batchRequest(work, new AbortController().signal, waiting)
  await vi.advanceTimersByTimeAsync(1000)
  expect(work).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1000)
  await expect(result).resolves.toBe('ok')
  expect(waiting).toHaveBeenCalledOnce()
})
it('cancels a rate-limit wait immediately without another request', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const work = vi.fn().mockRejectedValue({ code: 'RATE_LIMITED', retryAfter: 60 })
  const result = batchRequest(work, controller.signal, vi.fn())
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(0)
  controller.abort()
  await rejected
  expect(work).toHaveBeenCalledOnce()
})
