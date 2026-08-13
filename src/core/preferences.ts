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
    preventUpscale: options.preventUpscale,
    jpgBackgroundColor: options.jpgBackgroundColor,
    audioBitrate: options.audioBitrate,
    audioChannels: options.audioChannels,
    audioSampleRate: options.audioSampleRate,
    videoQuality: options.videoQuality,
    videoResolution: options.videoResolution,
    videoCodec: options.videoCodec,
  }
}

export function applyCompatibleSettings(
  source: ConversionOptions,
  input: MediaFormat,
  target: ConversionOptions,
): ConversionOptions {
  const kind = input === 'png' || input === 'jpg' || input === 'webp'
    ? 'image'
    : input === 'mp4' || input === 'webm' ? 'video' : 'audio'
  const outputFormat = isSupportedPair(input, source.outputFormat) ? source.outputFormat : target.outputFormat
  return kind === 'image'
    ? {
        ...target,
        outputFormat,
        quality: source.quality,
        width: source.width,
        height: source.height,
        lockAspectRatio: source.lockAspectRatio,
        preventUpscale: source.preventUpscale,
        jpgBackgroundColor: source.jpgBackgroundColor,
      }
    : kind === 'video'
      ? {
          ...target,
          outputFormat,
          audioBitrate: source.audioBitrate,
          audioChannels: source.audioChannels,
          audioSampleRate: source.audioSampleRate,
          videoQuality: source.videoQuality,
          videoResolution: source.videoResolution,
          videoCodec: source.videoCodec,
        }
      : {
          ...target,
          outputFormat,
          audioBitrate: source.audioBitrate,
          audioChannels: source.audioChannels,
          audioSampleRate: source.audioSampleRate,
        }
}
