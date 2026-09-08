import { getOutputFormats } from './registry'
import type { ConversionOptions, InputMediaFormat } from './types'

export function defaultOptions(input: InputMediaFormat): ConversionOptions {
  return {
    outputFormat: getOutputFormats(input)[0],
    audioBitrate: 192,
    audioChannels: 'source',
    audioSampleRate: 'source',
    videoQuality: 'balanced',
    videoResolution: 'original',
    videoCodec: 'auto',
  }
}
