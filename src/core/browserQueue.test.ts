import { afterEach, expect, it, vi } from 'vitest'
import { BrowserQueue } from './browserQueue'
import { downloadInBrowser } from './browserDownload'
import type { Inspection, Job, Output } from './remoteContracts'
vi.mock('./browserDownload', () => ({ downloadInBrowser: vi.fn() }))
const output: Output = { mode: 'audio', container: 'original', preset: 'best' }
const inspection = { id: 'inspection', title: 'Source audio', mediaId: 'track', browserDownload: true } as Inspection
const remoteJob = { id: 'remote-job', state: 'queued', created: 1, output } as Job
function setup() {
  const api = { plan: vi.fn().mockResolvedValue({ plan: { url: 'https://playback.media-streaming.soundcloud.cloud/test', filename: 'track.m4a', mime: 'audio/mp4', maxBytes: 1024, expires: Date.now() + 60000 } }), create: vi.fn().mockResolvedValue(remoteJob), cancel: vi.fn().mockResolvedValue({ ...remoteJob, state: 'cancelled' }), remove: vi.fn().mockResolvedValue({ removed: true }) }
  const queue = new BrowserQueue(api); queue.remember(inspection)
  return { queue, api }
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

it('keeps successful browser downloads in the queue without creating backend jobs', async () => {
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:http://localhost/file'); static revokeObjectURL = vi.fn() })
  vi.mocked(downloadInBrowser).mockResolvedValue(new Blob(['audio']))
  const { queue, api } = setup()
  const job = (await queue.create({ inspectionId: inspection.id, output }, 'key'))!
  await vi.waitFor(() => expect(queue.access(job.id)?.local).toBe(true))
  const first = queue.merge({ items: [], next: null })
  expect(queue.merge(first).items).toHaveLength(1)
  expect(first.items[0].state).toBe('ready')
  expect(api.create).not.toHaveBeenCalled()
  queue.delivered(job.id)
  expect(queue.merge(first).items[0].deliveredAt).toBeTruthy()
  await queue.remove(job.id)
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
})

it('falls back once, preserves queue identity, and reconciles server progress', async () => {
  vi.mocked(downloadInBrowser).mockRejectedValue(new TypeError('CORS'))
  const { queue, api } = setup()
  const local = (await queue.create({ inspectionId: inspection.id, output }, 'key'))!
  await vi.waitFor(() => expect(api.create).toHaveBeenCalledOnce())
  const merged = queue.merge({ items: [{ ...remoteJob, state: 'ready', artifactId: 'artifact' }], next: null })
  expect(merged.items).toHaveLength(1)
  expect(merged.items[0]).toMatchObject({ id: local.id, artifactId: 'artifact', state: 'ready' })
  expect(api.create).toHaveBeenCalledWith({ inspectionId: inspection.id, output }, 'key')
})

it('cancellation during a browser fetch never starts a fallback', async () => {
  vi.mocked(downloadInBrowser).mockImplementation((_plan, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))))
  const { queue, api } = setup()
  const job = (await queue.create({ inspectionId: inspection.id, output }, 'key'))!
  expect((await queue.cancel(job.id)).state).toBe('cancelled')
  await Promise.resolve()
  expect(api.create).not.toHaveBeenCalled()
})

it('sends conversions and metadata requests straight to the existing path', async () => {
  const { queue, api } = setup()
  for (const changes of [{ container: 'mp3' }, { metadata: true }, { cover: true }, { sampleRate: 48000 }]) expect(await queue.create({ inspectionId: inspection.id, output: { ...output, ...changes } }, 'key')).toBeNull()
  expect(api.plan).not.toHaveBeenCalled()
})

it('keeps the twenty-entry limit when many plan requests finish together', async () => {
  vi.mocked(downloadInBrowser).mockImplementation(() => new Promise(() => {}))
  const { queue, api } = setup()
  const plan = (await api.plan()).plan
  const finish: ((value: { plan: typeof plan }) => void)[] = []
  api.plan.mockImplementation(() => new Promise(resolve => { finish.push(resolve) }))
  const requests = Array.from({ length: 21 }, (_, i) => queue.create({ inspectionId: inspection.id, output }, `key-${i}`))
  finish.forEach(resolve => resolve({ plan }))
  const jobs = await Promise.all(requests)
  expect(jobs.filter(Boolean)).toHaveLength(20)
  expect(queue.merge({ items: [], next: null }).items).toHaveLength(20)
  expect((await queue.create({ inspectionId: inspection.id, output }, 'key-0'))?.id).toBe(jobs[0]?.id)
  expect(api.plan).toHaveBeenCalledTimes(22)
})
