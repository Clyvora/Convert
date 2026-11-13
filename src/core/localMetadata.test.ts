import { afterEach, expect, it, vi } from 'vitest'
import { readVideoMetadata } from './localMetadata'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
function setup() {
  const video = document.createElement('video')
  vi.spyOn(video, 'load').mockImplementation(() => {})
  vi.spyOn(document, 'createElement').mockReturnValue(video)
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:metadata') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  return video
}
it('continues importing when the browser never returns video metadata and releases its URL', async () => {
  vi.useFakeTimers(); const video = setup()
  const result = readVideoMetadata(new File(['video'], 'video.mkv'))
  await vi.advanceTimersByTimeAsync(3000)
  expect(await result).toEqual({})
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  expect(video.getAttribute('src')).toBeNull()
  expect(video.onloadedmetadata).toBeNull()
})
it('releases metadata readers immediately when file import is cancelled', async () => {
  vi.useFakeTimers(); setup()
  const controller = new AbortController()
  const result = readVideoMetadata(new File(['video'], 'video.mp4'), controller.signal)
  controller.abort()
  expect(await result).toEqual({})
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
