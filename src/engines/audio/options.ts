import { MP3_BITRATE_PRESETS } from './types'
import type { AudioFormat, Mp3Bitrate } from './types'

export const DEFAULT_MP3_BITRATE: Mp3Bitrate = 192

export function isMp3Bitrate(value: unknown): value is Mp3Bitrate {
  return typeof value === 'number' && MP3_BITRATE_PRESETS.some((preset) => preset === value)
}

export function isAudioFormat(value: unknown): value is AudioFormat {
  return value === 'mp3' || value === 'wav'
}

export function getAudioMimeType(format: AudioFormat): 'audio/mpeg' | 'audio/wav' {
  return format === 'mp3' ? 'audio/mpeg' : 'audio/wav'
}
