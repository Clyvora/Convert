import { defaultOptions } from './defaults'
import { isSupportedPair } from './registry'
import type { ConversionOptions, InputMediaFormat } from './types'

export type SavedPreferences = Partial<Record<InputMediaFormat, Partial<ConversionOptions>>>

export function mergePreferences(input: InputMediaFormat, saved: unknown): ConversionOptions {
  const defaults = defaultOptions(input)
  const stored = saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as SavedPreferences)[input] : undefined
  const candidate = { ...defaults, ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}) }
  if (!isSupportedPair(input, candidate.outputFormat)) candidate.outputFormat = defaults.outputFormat
  if (![96, 128, 192, 256, 320].includes(candidate.audioBitrate)) candidate.audioBitrate = defaults.audioBitrate
  if (!['source', 1, 2].includes(candidate.audioChannels)) candidate.audioChannels = defaults.audioChannels
  if (!['source', 44100, 48000].includes(candidate.audioSampleRate)) candidate.audioSampleRate = defaults.audioSampleRate
  if (!['smaller', 'balanced', 'high'].includes(candidate.videoQuality)) candidate.videoQuality = defaults.videoQuality
  if (!['original', 1080, 720, 480].includes(candidate.videoResolution)) candidate.videoResolution = defaults.videoResolution
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
