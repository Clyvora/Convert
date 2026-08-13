import { throwIfAborted } from './helpers'
import type { ImageDimensions, ImageMimeType } from './types'

interface RenderSurface {
  readonly usedOffscreenCanvas: boolean
  draw(source: CanvasImageSource, backgroundColor?: string): void
  encode(mimeType: ImageMimeType, quality: number | undefined, signal?: AbortSignal): Promise<Blob>
  dispose(): void
}

function assertEncodedType(blob: Blob, requestedType: ImageMimeType): Blob {
  if (blob.type !== requestedType) {
    throw new Error(
      `This browser cannot encode ${requestedType.replace('image/', '').toUpperCase()} images.`,
    )
  }

  return blob
}

function configureContext(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): void {
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
}

function drawToContext(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  dimensions: ImageDimensions,
  backgroundColor?: string,
): void {
  if (backgroundColor) {
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, dimensions.width, dimensions.height)
  }
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height)
}

function createOffscreenSurface(dimensions: ImageDimensions): RenderSurface | undefined {
  if (typeof OffscreenCanvas === 'undefined') return undefined

  const canvas = new OffscreenCanvas(dimensions.width, dimensions.height)
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) return undefined
  configureContext(context)

  return {
    usedOffscreenCanvas: true,
    draw: (source, backgroundColor) => {
      drawToContext(context, source, dimensions, backgroundColor)
    },
    encode: async (mimeType, quality, signal) => {
      throwIfAborted(signal)
      const blob = await canvas.convertToBlob({
        type: mimeType,
        ...(quality === undefined ? {} : { quality }),
      })
      throwIfAborted(signal)
      return assertEncodedType(blob, mimeType)
    },
    dispose: () => {
      canvas.width = 1
      canvas.height = 1
    },
  }
}

function createHtmlCanvasSurface(dimensions: ImageDimensions): RenderSurface {
  if (typeof document === 'undefined') {
    throw new Error('This browser does not provide a supported canvas implementation.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new Error('The browser could not create an image canvas.')
  configureContext(context)

  return {
    usedOffscreenCanvas: false,
    draw: (source, backgroundColor) => {
      drawToContext(context, source, dimensions, backgroundColor)
    },
    encode: (mimeType, quality, signal) => {
      throwIfAborted(signal)
      return new Promise((resolve, reject) => {
        const onAbort = (): void => {
          reject(signal?.reason ?? new DOMException('Conversion cancelled.', 'AbortError'))
        }
        signal?.addEventListener('abort', onAbort, { once: true })

        canvas.toBlob(
          (blob) => {
            signal?.removeEventListener('abort', onAbort)
            if (signal?.aborted) {
              reject(signal.reason)
            } else if (!blob) {
              reject(new Error('The browser failed to encode the converted image.'))
            } else {
              try {
                resolve(assertEncodedType(blob, mimeType))
              } catch (error) {
                reject(error)
              }
            }
          },
          mimeType,
          quality,
        )
      })
    },
    dispose: () => {
      canvas.width = 1
      canvas.height = 1
      canvas.remove()
    },
  }
}

export function createRenderSurface(dimensions: ImageDimensions): RenderSurface {
  return createOffscreenSurface(dimensions) ?? createHtmlCanvasSurface(dimensions)
}
