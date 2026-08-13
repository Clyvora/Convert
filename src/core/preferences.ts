import { defaultOptions } from './defaults'
import { isSupportedPair } from './registry'
import type { ConversionOptions, MediaFormat } from './types'

export type SavedPreferences = Partial<Record<MediaFormat, Partial<ConversionOptions>>>

export function mergePreferences(input: MediaFormat, saved: SavedPreferences): ConversionOptions {
  const defaults = defaultOptions(input)
  const candidate = { ...defaults, ...saved[input] }
  if (!isSupportedPair(input, candidate.outputFormat)) candidate.outputFormat = defaults.outputFormat
  return candidate
}

export function preferenceSubset(options: ConversionOptions): Partial<ConversionOptions> {
  return {
    outputFormat: options.outputFormat,
    quality: options.quality,
    lockAspectRatio: options.lockAspectRatio,
    jpgBackgroundColor: options.jpgBackgroundColor,
    mp3Bitrate: options.mp3Bitrate,
  }
}

export function applyCompatibleSettings(
  source: ConversionOptions,
  input: MediaFormat,
  target: ConversionOptions,
): ConversionOptions {
  const isImage = input === 'png' || input === 'jpg' || input === 'webp'
  const outputFormat = isSupportedPair(input, source.outputFormat) ? source.outputFormat : target.outputFormat
  return isImage
    ? {
        ...target,
        outputFormat,
        quality: source.quality,
        width: source.width,
        height: source.height,
        lockAspectRatio: source.lockAspectRatio,
        jpgBackgroundColor: source.jpgBackgroundColor,
      }
    : { ...target, outputFormat, mp3Bitrate: source.mp3Bitrate }
}
