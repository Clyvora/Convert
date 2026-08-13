import { getOutputFormats } from './registry'
import type { ConversionOptions, MediaFormat } from './types'

export function defaultOptions(input: MediaFormat): ConversionOptions {
  return {
    outputFormat: getOutputFormats(input)[0],
    quality: 0.9,
    lockAspectRatio: true,
    jpgBackgroundColor: '#ffffff',
    mp3Bitrate: 192,
  }
}
