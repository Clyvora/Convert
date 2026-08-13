import type { ConversionEngine, ConversionOptions } from '../../core/types'
import { convertImage } from './convert'

/** Shared engine adapter for the browser-native image pipeline. */
export class ImageConversionEngine implements ConversionEngine {
  async convert(
    file: File,
    options: ConversionOptions,
    signal: AbortSignal,
    onProgress: (progress: number | null, label?: string) => void,
  ): Promise<Blob> {
    const result = await convertImage(file, {
      outputFormat: options.outputFormat as 'png' | 'jpg' | 'webp',
      width: options.width,
      height: options.height,
      lockAspectRatio: options.lockAspectRatio,
      preventUpscale: options.preventUpscale,
      quality: options.quality,
      jpgBackgroundColor: options.jpgBackgroundColor,
      signal,
      onProgress: (phase) => onProgress(null, `${phase[0].toUpperCase()}${phase.slice(1)} image`),
    })
    return result.blob
  }
}
