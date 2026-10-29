import { defaultOptions } from './defaults'
import { isSupportedPair } from './registry'
import type { ConversionOptions, InputMediaFormat } from './types'

export type SavedPreferences = Partial<Record<InputMediaFormat, Partial<ConversionOptions>>>

export function mergePreferences(input: InputMediaFormat, saved: SavedPreferences): ConversionOptions {
  const defaults = defaultOptions(input)
  const candidate = { ...defaults, ...saved[input] }
  if (!isSupportedPair(input, candidate.outputFormat)) candidate.outputFormat = defaults.outputFormat
  // Codec selection is derived from the output container.
  candidate.videoCodec = 'auto'
  return candidate
}

export function preferenceSubset(options: ConversionOptions): Partial<ConversionOptions> {
  return {
    outputFormat: options.outputFormat,
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
  input: InputMediaFormat,
  target: ConversionOptions,
): ConversionOptions {
  const kind = input === 'mp4' || input === 'webm' || input === 'mkv' ? 'video' : 'audio'
  const outputFormat = isSupportedPair(input, source.outputFormat) ? source.outputFormat : target.outputFormat
  return kind === 'video'
      ? {
          ...target,
          outputFormat,
          audioBitrate: source.audioBitrate,
          audioChannels: source.audioChannels,
          audioSampleRate: source.audioSampleRate,
          videoQuality: source.videoQuality,
          videoResolution: source.videoResolution,
          videoCodec: 'auto',
        }
    : {
          ...target,
          outputFormat,
          audioBitrate: source.audioBitrate,
          audioChannels: source.audioChannels,
          audioSampleRate: source.audioSampleRate,
        }
}
