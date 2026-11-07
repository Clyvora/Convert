import { expect, it, vi } from 'vitest'
import type { BrowserPlan, BrowserStream } from './remoteContracts'
const state = vi.hoisted(() => ({ exec: vi.fn(), terminate: vi.fn(), active: 0, peak: 0 }))
vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: class {
  loaded = false
  load = async () => { this.loaded = true }
  createDir = async () => {}
  writeFile = async () => {}
  deleteFile = async () => {}
  deleteDir = async () => {}
  readFile = async () => new Uint8Array([1, 2, 3])
  terminate = state.terminate
  exec = async (...args: unknown[]) => { state.active++; state.peak = Math.max(state.peak, state.active); try { return await state.exec(...args) } finally { state.active-- } }
} }))
vi.mock('../engines/audio/ffmpegAssets', () => ({ getFfmpegAssetUrls: () => ({}) }))
import { muxBrowserMedia } from './browserMux'

it('serializes local muxes, copies both codecs, and cancelling a waiter does not stop the active file', async () => {
  let finish!: (value: number) => void
  state.exec.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(0)
  const video: BrowserStream = { url: 'unused', protocol: 'file', role: 'video', ext: 'mp4' }
  const audio: BrowserStream = { url: 'unused', protocol: 'file', role: 'audio', ext: 'm4a' }
  const blob = (text: string) => Object.assign(new Blob([text]), { arrayBuffer: async () => new TextEncoder().encode(text).buffer })
  const inputs = [{ stream: video, ext: 'mp4', blob: blob('video') }, { stream: audio, ext: 'm4a', blob: blob('audio') }]
  const plan: BrowserPlan = { url: 'unused', filename: 'test.mp4', mime: 'video/mp4', maxBytes: 1024, expires: Date.now() + 10000, mode: 'combined', container: 'mp4' }
  const first = muxBrowserMedia(inputs, plan, new AbortController().signal)
  await vi.waitFor(() => expect(state.exec).toHaveBeenCalledOnce())
  const abort = new AbortController()
  const cancelled = muxBrowserMedia(inputs, plan, abort.signal)
  const rejected = expect(cancelled).rejects.toThrow()
  abort.abort(); await rejected
  const next = muxBrowserMedia(inputs, plan, new AbortController().signal)
  expect(state.exec).toHaveBeenCalledOnce()
  expect(state.terminate).not.toHaveBeenCalled()
  finish(0)
  expect((await first).size).toBe(3)
  expect((await next).size).toBe(3)
  expect(state.peak).toBe(1)
  const args = state.exec.mock.calls[0][0]
  expect(args).toEqual(expect.arrayContaining(['-c', 'copy', '0:v:0', '1:a:0']))
})
