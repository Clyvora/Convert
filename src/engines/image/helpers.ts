import type {
  ImageDimensions,
  ImageMimeType,
  ImageOutputFormat,
  ImageRenderPlan,
  ImageResizeOptions,
} from './types'

const MAX_CANVAS_DIMENSION = 32_767
const MAX_CANVAS_PIXELS = 268_435_456

export const DEFAULT_IMAGE_QUALITY: Readonly<Record<'jpg' | 'webp', number>> = {
  jpg: 0.92,
  webp: 0.9,
}

export const IMAGE_MIME_TYPES: Readonly<Record<ImageOutputFormat, ImageMimeType>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive whole number.`)
  }

  if (value > MAX_CANVAS_DIMENSION) {
    throw new RangeError(
      `${label} exceeds the browser-safe canvas limit of ${MAX_CANVAS_DIMENSION.toLocaleString()} pixels.`,
    )
  }
}

function assertSourceDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive whole number.`)
  }
}

export function validateCanvasDimensions(width: number, height: number): ImageDimensions {
  assertDimension(width, 'Image width')
  assertDimension(height, 'Image height')

  if (width * height > MAX_CANVAS_PIXELS) {
    throw new RangeError(
      'The requested image dimensions require too much canvas memory for reliable browser conversion.',
    )
  }

  return { width, height }
}

/**
 * Calculates final canvas dimensions. When both locked dimensions are supplied,
 * they form a bounding box and the image is fitted inside it without cropping.
 */
export function calculateOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  options: ImageResizeOptions = {},
): ImageDimensions {
  // The decoded source is not itself a canvas. Allow a very large source to be
  // reduced to a safe output instead of rejecting it before resize is applied.
  assertSourceDimension(sourceWidth, 'Source width')
  assertSourceDimension(sourceHeight, 'Source height')

  const { width, height, lockAspectRatio = true } = options
  if (width !== undefined) assertDimension(width, 'Output width')
  if (height !== undefined) assertDimension(height, 'Output height')

  if (width === undefined && height === undefined) {
    return validateCanvasDimensions(sourceWidth, sourceHeight)
  }

  if (!lockAspectRatio) {
    return validateCanvasDimensions(width ?? sourceWidth, height ?? sourceHeight)
  }

  const ratio = sourceWidth / sourceHeight
  let outputWidth: number
  let outputHeight: number

  if (width !== undefined && height !== undefined) {
    const scale = Math.min(width / sourceWidth, height / sourceHeight)
    outputWidth = Math.max(1, Math.round(sourceWidth * scale))
    outputHeight = Math.max(1, Math.round(sourceHeight * scale))
  } else if (width !== undefined) {
    outputWidth = width
    outputHeight = Math.max(1, Math.round(width / ratio))
  } else {
    outputHeight = height as number
    outputWidth = Math.max(1, Math.round((height as number) * ratio))
  }

  return validateCanvasDimensions(outputWidth, outputHeight)
}

/** Returns both dimensions after changing one control while aspect lock is on. */
export function calculateAspectLockedDimensions(
  sourceWidth: number,
  sourceHeight: number,
  changedDimension: 'width' | 'height',
  value: number,
): ImageDimensions {
  return calculateOutputDimensions(sourceWidth, sourceHeight, {
    [changedDimension]: value,
    lockAspectRatio: true,
  })
}

export function validateImageQuality(
  outputFormat: ImageOutputFormat,
  quality?: number,
): number | undefined {
  if (outputFormat === 'png') return undefined

  const resolved = quality ?? DEFAULT_IMAGE_QUALITY[outputFormat]
  if (!Number.isFinite(resolved) || resolved < 0 || resolved > 1) {
    throw new RangeError('Image quality must be a number from 0 to 1.')
  }

  return resolved
}

/**
 * Color inputs originate from an HTML color control. Restricting this to opaque
 * hex values avoids browser-dependent CSS parsing and guarantees opaque JPEG output.
 */
export function normalizeJpegBackgroundColor(color?: string): string {
  const candidate = color?.trim() || '#ffffff'
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(candidate)

  if (shortHex) {
    const [, red, green, blue] = shortHex
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase()
  }

  if (/^#[\da-f]{6}$/i.test(candidate)) return candidate.toLowerCase()

  throw new TypeError('JPEG background color must be an opaque hex color such as #ffffff.')
}

export function getImageRenderPlan(
  outputFormat: ImageOutputFormat,
  jpgBackgroundColor?: string,
): ImageRenderPlan {
  if (outputFormat !== 'jpg') return { preserveTransparency: true }

  return {
    preserveTransparency: false,
    backgroundColor: normalizeJpegBackgroundColor(jpgBackgroundColor),
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Conversion cancelled.', 'AbortError')
  }
}
