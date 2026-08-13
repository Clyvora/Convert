import { getOutputFormats } from './registry'
import type { ConversionOptions, MediaFormat } from './types'

export function defaultOptions(input: MediaFormat): ConversionOptions {
  return {
    outputFormat: getOutputFormats(input)[0],
    quality: 0.9,
    lockAspectRatio: true,
    preventUpscale: true,
    jpgBackgroundColor: '#ffffff',
    audioBitrate: 192,
    audioChannels: 'source',
    audioSampleRate: 'source',
    videoQuality: 'balanced',
    videoResolution: 'original',
    videoCodec: 'auto',
  }
}
