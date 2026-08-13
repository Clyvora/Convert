import { afterEach, describe, expect, it, vi } from 'vitest'

import { convertImage } from './index'

interface FakeContext {
  fillStyle: string
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: ImageSmoothingQuality
  fillRect: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
}

describe('image conversion pipeline', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('decodes, resizes, paints a JPEG background, encodes, and releases resources', async () => {
    const close = vi.fn()
    const bitmap = { width: 4, height: 2, close } as unknown as ImageBitmap
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap)
    const context: FakeContext = {
      fillStyle: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }
    const encoded = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    const convertToBlob = vi.fn().mockResolvedValue(encoded)
    const createdCanvases: Array<{ width: number; height: number }> = []

    class FakeOffscreenCanvas {
      width: number
      height: number

      constructor(width: number, height: number) {
        this.width = width
        this.height = height
        createdCanvases.push(this)
      }

      getContext(): FakeContext {
        return context
      }

      convertToBlob = convertToBlob
    }

    vi.stubGlobal('createImageBitmap', createImageBitmap)
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
    const phases: string[] = []

    const result = await convertImage(new Blob(['fixture'], { type: 'image/png' }), {
      outputFormat: 'jpg',
      width: 2,
      lockAspectRatio: true,
      quality: 0.8,
      jpgBackgroundColor: '#f0f0f0',
      onProgress: (phase) => phases.push(phase),
    })

    expect(result).toMatchObject({
      blob: encoded,
      mimeType: 'image/jpeg',
      width: 2,
      height: 1,
      sourceWidth: 4,
      sourceHeight: 2,
      usedOffscreenCanvas: true,
    })
    expect(phases).toEqual(['decoding', 'rendering', 'encoding'])
    expect(context.fillStyle).toBe('#f0f0f0')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 2, 1)
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2, 1)
    expect(context.fillRect.mock.invocationCallOrder[0]).toBeLessThan(
      context.drawImage.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.8 })
    expect(close).toHaveBeenCalledOnce()
    expect(createdCanvases[0]).toMatchObject({ width: 1, height: 1 })
  })
})
