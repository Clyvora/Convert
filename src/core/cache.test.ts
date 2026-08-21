import { describe, expect, it, vi } from 'vitest'

import { clearCachedMediaEngineFiles } from './cache'

describe('cached media-engine cleanup', () => {
  it('removes only FFmpeg runtime entries and preserves the offline app shell', async () => {
    const shell = new Request('https://convert.example/')
    const script = new Request('https://convert.example/assets/index.js')
    const ffmpeg = new Request('https://convert.example/ffmpeg/runtime/v0.12.10/single/ffmpeg-core.wasm')
    const deleteEntry = vi.fn(async () => true)
    const cache = { keys: vi.fn(async () => [shell, script, ffmpeg]), delete: deleteEntry }
    const storage = {
      keys: vi.fn(async () => ['clyvora-convert-v3', 'unrelated-cache']),
      open: vi.fn(async () => cache),
    } as unknown as CacheStorage

    await expect(clearCachedMediaEngineFiles(storage)).resolves.toBe(1)
    expect(storage.open).toHaveBeenCalledWith('clyvora-convert-v3')
    expect(deleteEntry).toHaveBeenCalledOnce()
    expect(deleteEntry).toHaveBeenCalledWith(ffmpeg)
  })
})
