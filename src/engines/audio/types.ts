import type {
  AudioBitrate,
  AudioChannels,
  AudioFormat,
  AudioSampleRate,
  VideoCodec,
  VideoFormat,
  VideoQuality,
  VideoResolution,
} from '../../core/types'

export const AUDIO_BITRATE_PRESETS = [96, 128, 192, 256, 320] as const
export const MP3_BITRATE_PRESETS = [128, 192, 256, 320] as const

export type Mp3Bitrate = (typeof MP3_BITRATE_PRESETS)[number]
export type LocalMediaFormat = AudioFormat | VideoFormat
export type LocalMediaEngineMode = 'single-thread' | 'multi-thread'
export type AudioEngineMode = LocalMediaEngineMode
export type LocalMediaProgressPhase = 'loading-engine' | 'converting'
export type AudioProgressPhase = LocalMediaProgressPhase

export interface LocalMediaProgress {
  phase: LocalMediaProgressPhase
  progress: number | null
}

export type AudioProgress = LocalMediaProgress

export interface LocalMediaConversionOptions {
  outputFormat: LocalMediaFormat
  audioBitrate: AudioBitrate
  audioChannels: AudioChannels
  audioSampleRate: AudioSampleRate
  videoQuality: VideoQuality
  videoResolution: VideoResolution
  videoCodec: VideoCodec
  signal?: AbortSignal
  onProgress?: (progress: LocalMediaProgress) => void
}

export type AudioConversionOptions = LocalMediaConversionOptions

export interface LocalMediaConversionResult {
  blob: Blob
  format: LocalMediaFormat
  mimeType: string
  engineMode: LocalMediaEngineMode
}

export type AudioConversionResult = LocalMediaConversionResult

export type LocalMediaConversionErrorCode =
  | 'cancelled'
  | 'engine-load-failed'
  | 'invalid-options'
  | 'conversion-failed'

export type AudioConversionErrorCode = LocalMediaConversionErrorCode

export class AudioConversionError extends Error {
  readonly code: LocalMediaConversionErrorCode

  constructor(code: LocalMediaConversionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LocalMediaConversionError'
    this.code = code
  }
}
