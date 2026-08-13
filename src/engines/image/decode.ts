import { throwIfAborted } from './helpers'

export interface DecodedImage {
  readonly source: CanvasImageSource
  readonly width: number
  readonly height: number
  readonly dispose: () => void
}

function imageBitmapApiAvailable(): boolean {
  return typeof globalThis.createImageBitmap === 'function'
}

async function decodeWithImageBitmap(blob: Blob, signal?: AbortSignal): Promise<DecodedImage> {
  throwIfAborted(signal)
  const bitmap = await globalThis.createImageBitmap(blob)

  try {
    throwIfAborted(signal)
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new TypeError('The image has invalid dimensions.')
    }

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    }
  } catch (error) {
    bitmap.close()
    throw error
  }
}

function decodeWithImageElement(blob: Blob, signal?: AbortSignal): Promise<DecodedImage> {
  throwIfAborted(signal)

  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return Promise.reject(new Error('This browser does not provide a supported image decoder.'))
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()
    image.decoding = 'async'
    let settled = false

    const cleanupListeners = (): void => {
      image.onload = null
      image.onerror = null
      signal?.removeEventListener('abort', onAbort)
      URL.revokeObjectURL(objectUrl)
    }

    const fail = (error: unknown): void => {
      if (settled) return
      settled = true
      cleanupListeners()
      image.src = ''
      reject(error)
    }

    const onAbort = (): void => fail(signal?.reason ?? new DOMException('Conversion cancelled.', 'AbortError'))

    image.onload = () => {
      if (settled) return
      if (image.naturalWidth < 1 || image.naturalHeight < 1) {
        fail(new TypeError('The image has invalid dimensions.'))
        return
      }

      settled = true
      cleanupListeners()
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => {
          image.src = ''
        },
      })
    }
    image.onerror = () => fail(new TypeError('The selected file could not be decoded as an image.'))
    signal?.addEventListener('abort', onAbort, { once: true })
    image.src = objectUrl
  })
}

export async function decodeImage(blob: Blob, signal?: AbortSignal): Promise<DecodedImage> {
  if (imageBitmapApiAvailable()) {
    try {
      return await decodeWithImageBitmap(blob, signal)
    } catch (error) {
      if (signal?.aborted) throw error
      // Some Safari versions expose createImageBitmap but reject formats that an
      // HTMLImageElement can decode, so retain the element fallback.
    }
  }

  return decodeWithImageElement(blob, signal)
}
