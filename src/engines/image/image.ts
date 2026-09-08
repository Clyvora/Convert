export type ImageFormat = 'png' | 'jpg' | 'webp'

export const LIMITS = {
  maxInputBytes: 25 * 1024 * 1024,
  maxSourceDimension: 12_000,
  maxSourcePixels: 40_000_000,
  maxOutputDimension: 8_192,
  maxOutputPixels: 32_000_000,
  constrainedMemoryBytes: 128 * 1024 * 1024,
  standardMemoryBytes: 256 * 1024 * 1024,
  batchSize: 1,
} as const

export interface ImageInfo {
  format: ImageFormat
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
}

export interface ResizeOptions {
  width: number
  height: number
  outputFormat: ImageFormat
  quality: number
  signal?: AbortSignal
  onProgress?: (phase: 'decoding' | 'rendering' | 'encoding') => void
}

export interface ResizeResult extends ImageInfo { blob: Blob }

function readUint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function pngInfo(bytes: Uint8Array): ImageInfo | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value) || ascii(bytes, 12, 4) !== 'IHDR') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { format: 'png', mimeType: 'image/png', width: view.getUint32(16), height: view.getUint32(20) }
}

function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue }
    const marker = bytes[offset + 1]!
    offset += 2
    if (marker === 0xd8 || marker === 0xd9) continue
    if (marker === 0xda) break
    if (offset + 2 > bytes.length) break
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!
    if (length < 2 || offset + length > bytes.length) break
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
    if (isStartOfFrame && length >= 7) {
      return {
        format: 'jpg', mimeType: 'image/jpeg',
        height: (bytes[offset + 3]! << 8) | bytes[offset + 4]!,
        width: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
      }
    }
    offset += length
  }
  throw new Error('The JPEG dimensions could not be read safely. Re-export the image and try again.')
}

function webpInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8X') return { format: 'webp', mimeType: 'image/webp', width: 1 + readUint24(bytes, 24), height: 1 + readUint24(bytes, 27) }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const width = 1 + (bytes[21]! | ((bytes[22]! & 0x3f) << 8))
    const height = 1 + ((bytes[22]! >> 6) | (bytes[23]! << 2) | ((bytes[24]! & 0x0f) << 10))
    return { format: 'webp', mimeType: 'image/webp', width, height }
  }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      format: 'webp', mimeType: 'image/webp',
      width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
      height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
    }
  }
  throw new Error('The WebP dimensions could not be read safely. Re-export the image and try again.')
}

export function inspectEncodedImage(bytes: Uint8Array): ImageInfo {
  const info = pngInfo(bytes) ?? jpegInfo(bytes) ?? webpInfo(bytes)
  if (!info) throw new Error('Choose a valid PNG, JPEG, or WebP image.')
  if (!Number.isSafeInteger(info.width) || !Number.isSafeInteger(info.height) || info.width < 1 || info.height < 1) throw new Error('The image reports invalid dimensions.')
  if (info.width > LIMITS.maxSourceDimension || info.height > LIMITS.maxSourceDimension) throw new Error(`Source dimensions must not exceed ${LIMITS.maxSourceDimension.toLocaleString()} pixels per side.`)
  if (info.width * info.height > LIMITS.maxSourcePixels) throw new Error(`This image contains more than ${Math.round(LIMITS.maxSourcePixels / 1_000_000)} million pixels and is unsafe to decode in a browser tab.`)
  return info
}

export async function inspectImage(file: File): Promise<ImageInfo> {
  if (file.size === 0) throw new Error('The selected image is empty.')
  if (file.size > LIMITS.maxInputBytes) throw new Error(`Images must be ${Math.round(LIMITS.maxInputBytes / 1024 / 1024)} MB or smaller.`)
  return inspectEncodedImage(new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer()))
}

export function validateOutput(width: number, height: number, source: ImageInfo, deviceMemory?: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new Error('Width and height must be positive whole numbers.')
  if (width > LIMITS.maxOutputDimension || height > LIMITS.maxOutputDimension) throw new Error(`Output dimensions must not exceed ${LIMITS.maxOutputDimension.toLocaleString()} pixels per side.`)
  if (width * height > LIMITS.maxOutputPixels) throw new Error(`Output must not exceed ${Math.round(LIMITS.maxOutputPixels / 1_000_000)} million pixels.`)
  const estimatedBytes = source.width * source.height * 4 + width * height * 4 + 16 * 1024 * 1024
  const budget = deviceMemory !== undefined && deviceMemory <= 4 ? LIMITS.constrainedMemoryBytes : LIMITS.standardMemoryBytes
  if (estimatedBytes > budget) throw new Error(`This operation may need about ${Math.ceil(estimatedBytes / 1024 / 1024)} MB of decoded memory, above this tool's ${Math.round(budget / 1024 / 1024)} MB safety budget. Choose smaller dimensions.`)
}

export function dimensionsFromWidth(source: ImageInfo, width: number): { width: number; height: number } {
  return { width, height: Math.max(1, Math.round(width * source.height / source.width)) }
}

export function dimensionsFromHeight(source: ImageInfo, height: number): { width: number; height: number } {
  return { width: Math.max(1, Math.round(height * source.width / source.height)), height }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Image processing cancelled.', 'AbortError')
}

async function decode(file: File, signal?: AbortSignal): Promise<{ source: CanvasImageSource; dispose: () => void }> {
  throwIfAborted(signal)
  if ('createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(file)
    if (signal?.aborted) { bitmap.close(); throwIfAborted(signal) }
    return { source: bitmap, dispose: () => bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The browser could not decode this image.'))
      image.src = url
    })
    throwIfAborted(signal)
    return { source: image, dispose: () => { image.src = ''; URL.revokeObjectURL(url) } }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function encode(canvas: HTMLCanvasElement, mimeType: string, quality: number, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (signal?.aborted) { reject(signal.reason ?? new DOMException('Image processing cancelled.', 'AbortError')); return }
      if (!blob) { reject(new Error('This browser could not encode the selected output format.')); return }
      if (blob.type !== mimeType) { reject(new Error('This browser does not support the selected image output format.')); return }
      resolve(blob)
    }, mimeType, quality)
  })
}

export async function resizeImage(file: File, sourceInfo: ImageInfo, options: ResizeOptions): Promise<ResizeResult> {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  validateOutput(options.width, options.height, sourceInfo, deviceMemory)
  const mimeType = ({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const)[options.outputFormat]
  options.onProgress?.('decoding')
  const decoded = await decode(file, options.signal)
  const canvas = document.createElement('canvas')
  canvas.width = options.width
  canvas.height = options.height
  try {
    throwIfAborted(options.signal)
    const context = canvas.getContext('2d', { alpha: options.outputFormat !== 'jpg' })
    if (!context) throw new Error('The browser could not create an image processing surface.')
    options.onProgress?.('rendering')
    if (options.outputFormat === 'jpg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height) }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
    throwIfAborted(options.signal)
    options.onProgress?.('encoding')
    const blob = await encode(canvas, mimeType, options.quality, options.signal)
    return { blob, format: options.outputFormat, mimeType, width: options.width, height: options.height }
  } finally {
    canvas.width = 0
    canvas.height = 0
    decoded.dispose()
  }
}
