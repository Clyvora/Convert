export const MP3_BITRATE_PRESETS = [128, 192, 256, 320] as const

export type Mp3Bitrate = (typeof MP3_BITRATE_PRESETS)[number]
export type AudioFormat = 'mp3' | 'wav'
export type AudioEngineMode = 'single-thread' | 'multi-thread'
export type AudioProgressPhase = 'loading-engine' | 'converting'

export interface AudioProgress {
  phase: AudioProgressPhase
  /** A normalized value from 0 to 1. Engine-loading progress is intentionally indeterminate. */
  progress: number | null
}

export interface AudioConversionOptions {
  outputFormat: AudioFormat
  bitrateKbps?: Mp3Bitrate
  signal?: AbortSignal
  onProgress?: (progress: AudioProgress) => void
}

export interface AudioConversionResult {
  blob: Blob
  format: AudioFormat
  mimeType: 'audio/mpeg' | 'audio/wav'
  engineMode: AudioEngineMode
}

export type AudioConversionErrorCode =
  | 'cancelled'
  | 'engine-load-failed'
  | 'invalid-options'
  | 'conversion-failed'

export class AudioConversionError extends Error {
  readonly code: AudioConversionErrorCode

  constructor(code: AudioConversionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AudioConversionError'
    this.code = code
  }
}
