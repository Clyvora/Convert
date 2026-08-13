import { createRenderSurface } from './canvas'
import { decodeImage } from './decode'
import {
  calculateOutputDimensions,
  getImageRenderPlan,
  IMAGE_MIME_TYPES,
  throwIfAborted,
  validateImageQuality,
} from './helpers'
import type { ImageConversionOptions, ImageConversionResult } from './types'

export async function convertImage(
  source: Blob,
  options: ImageConversionOptions,
): Promise<ImageConversionResult> {
  if (source.size === 0) throw new TypeError('The selected image is empty.')

  const { signal, onProgress } = options
  throwIfAborted(signal)
  const quality = validateImageQuality(options.outputFormat, options.quality)
  const renderPlan = getImageRenderPlan(options.outputFormat, options.jpgBackgroundColor)
  const mimeType = IMAGE_MIME_TYPES[options.outputFormat]

  onProgress?.('decoding')
  const decoded = await decodeImage(source, signal)

  try {
    throwIfAborted(signal)
    const dimensions = calculateOutputDimensions(decoded.width, decoded.height, options)
    const surface = createRenderSurface(dimensions)

    try {
      onProgress?.('rendering')
      surface.draw(decoded.source, renderPlan.backgroundColor)
      throwIfAborted(signal)

      onProgress?.('encoding')
      const blob = await surface.encode(mimeType, quality, signal)

      return {
        blob,
        mimeType,
        width: dimensions.width,
        height: dimensions.height,
        sourceWidth: decoded.width,
        sourceHeight: decoded.height,
        usedOffscreenCanvas: surface.usedOffscreenCanvas,
      }
    } finally {
      surface.dispose()
    }
  } finally {
    decoded.dispose()
  }
}
