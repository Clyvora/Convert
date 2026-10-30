import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useRemoteMedia } from './useRemoteMedia'

const api = vi.hoisted(() => ({ discovery: vi.fn(), discoveryItems: vi.fn(), inspect: vi.fn(), create: vi.fn(), jobs: vi.fn(), discoveries: vi.fn() }))
vi.mock('./mediaClient', () => ({ remoteMedia: {
  capabilities: () => new Promise(() => {}),
  jobs: (...args: unknown[]) => api.jobs(...args) ?? Promise.resolve({ items: [{ id: 'ready-job', state: 'ready' }] }),
  discoveries: (...args: unknown[]) => api.discoveries(...args) ?? new Promise(() => {}),
  discovery: (...args: unknown[]) => api.discovery(...args),
  discoveryItems: (...args: unknown[]) => api.discoveryItems(...args),
  inspect: (...args: unknown[]) => api.inspect(...args),
  create: (...args: unknown[]) => api.create(...args),
} }))
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })

it('shows ready downloads while capabilities and history are still pending', async () => {
  const { result, unmount } = renderHook(() => useRemoteMedia())
  await waitFor(() => expect(result.current.jobs[0]?.id).toBe('ready-job'))
  expect(result.current.caps).toBeNull()
  unmount()
})

it('keeps polling downloads while collection requests are pending', async () => {
  vi.useFakeTimers()
  api.discoveries.mockResolvedValue({ items: [{ id: 'collection', state: 'discovering' }] })
  api.discoveryItems.mockResolvedValue({ items: [], next: null })
  api.discovery.mockImplementation(() => new Promise(() => {}))
  const view = renderHook(() => useRemoteMedia())
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(api.discovery).toHaveBeenCalledOnce()
  const polls = api.jobs.mock.calls.length
  api.jobs.mockResolvedValue({ items: [{ id: 'newly-ready', state: 'ready' }] })
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(api.jobs.mock.calls.length).toBeGreaterThan(polls)
  expect(view.result.current.jobs[0].id).toBe('newly-ready')
  expect(api.discovery).toHaveBeenCalledOnce()
  view.unmount()
})

it('ends the check phase before waiting for job creation', async () => {
  api.inspect.mockResolvedValue({ id: 'checked', kind: 'media', formats: [{ audio: 'aac' }], restrictions: [], subtitles: [] })
  let finish!: (job: unknown) => void
  api.create.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = renderHook(() => useRemoteMedia())
  act(() => view.result.current.setURL('https://example.com/video'))
  act(() => { void view.result.current.submit() })
  await waitFor(() => expect(api.create).toHaveBeenCalledOnce())
  expect(view.result.current.checking).toBe(false)
  expect(view.result.current.busy).toBe(true)
  expect(view.result.current.status).toBe('Adding your download to the queue…')
  await act(async () => { finish({ id: 'job', state: 'queued' }) })
  expect(view.result.current.busy).toBe(false)
  view.unmount()
})


it('ignores a poll started before a new job was created', async () => {
  let finish!: (value: unknown) => void
  const job = { id: 'new-job', state: 'queued' }
  api.jobs.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ items: [job] })
  api.inspect.mockResolvedValue({ id: 'checked', kind: 'media', formats: [{ audio: 'aac' }], restrictions: [], subtitles: [] })
  api.create.mockResolvedValue(job)
  const view = renderHook(() => useRemoteMedia())
  act(() => view.result.current.setURL('https://example.com/video'))
  await act(async () => { await view.result.current.submit() })
  expect(view.result.current.jobs[0].id).toBe('new-job')
  await act(async () => { finish({ items: [] }) })
  expect(view.result.current.jobs[0].id).toBe('new-job')
  view.unmount()
})

it('polls idle queues twice a minute without rendering unchanged data', async () => {
  vi.useFakeTimers()
  api.jobs.mockImplementation(async () => ({ items: [] }))
  api.discoveries.mockResolvedValue({ items: [] })
  let renders = 0
  const view = renderHook(() => { renders++; return useRemoteMedia() })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  const baseline = renders
  for (let i = 0; i < 30; i++) await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(api.jobs).toHaveBeenCalledTimes(3)
  expect(renders).toBe(baseline)
  view.unmount()
})


it('queues independent links once and continues after errors and collections', async () => {
  const media = { kind: 'media', formats: [{ audio: 'aac' }], restrictions: [], subtitles: [] }
  api.inspect.mockResolvedValueOnce({ ...media, id: 'one' }).mockRejectedValueOnce(new Error('Source unavailable')).mockResolvedValueOnce({ ...media, id: 'collection', kind: 'playlist' }).mockResolvedValueOnce({ ...media, id: 'four' })
  api.create.mockResolvedValueOnce({ id: 'job-one', state: 'queued' }).mockResolvedValueOnce({ id: 'job-four', state: 'queued' })
  const view = renderHook(() => useRemoteMedia())
  act(() => view.result.current.setURL('https://example.com/one\nhttps://example.com/two\nhttps://example.com/three\nhttps://example.com/four\nhttps://example.com/one'))
  await act(async () => { await view.result.current.submit() })
  expect(api.inspect).toHaveBeenCalledTimes(4)
  expect(api.create).toHaveBeenCalledTimes(2)
  expect(view.result.current.linkResults.map(item => item.state)).toEqual(['queued', 'failed', 'failed', 'queued'])
  expect(view.result.current.linkResults[2].message).toContain('separately')
  expect(view.result.current.status).toContain('2 of 4')
  view.unmount()
})
it('stops checking remaining links when a batch is cancelled', async () => {
  api.inspect.mockImplementation((_url, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })))
  const view = renderHook(() => useRemoteMedia())
  act(() => view.result.current.setURL('https://example.com/one\nhttps://example.com/two'))
  let submission!: Promise<void>
  act(() => { submission = view.result.current.submit() })
  await waitFor(() => expect(api.inspect).toHaveBeenCalledOnce())
  await act(async () => { view.result.current.stopAddingLinks(); await submission })
  expect(view.result.current.linkResults.map(item => item.state)).toEqual(['cancelled', 'cancelled'])
  expect(api.create).not.toHaveBeenCalled()
  expect(view.result.current.busy).toBe(false)
  view.unmount()
})
it('rejects oversized batches before making any requests', async () => {
  const view = renderHook(() => useRemoteMedia())
  act(() => view.result.current.setURL(Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`).join('\n')))
  await act(async () => { await view.result.current.submit() })
  expect(view.result.current.error).toContain('20 links')
  expect(api.inspect).not.toHaveBeenCalled()
  view.unmount()
})
