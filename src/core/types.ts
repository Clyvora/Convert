export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'opus' | 'm4a' | 'flac'
export type VideoFormat = 'mp4' | 'webm' | 'mkv'
export type MediaFormat = AudioFormat | VideoFormat
export type ImportedAudioFormat = 'aac' | 'ts'
export type InputMediaFormat = MediaFormat | ImportedAudioFormat
export type MediaKind = 'audio' | 'video'
export type AudioBitrate = 96 | 128 | 192 | 256 | 320
export type AudioChannels = 'source' | 1 | 2
export type AudioSampleRate = 'source' | 44_100 | 48_000
export type VideoQuality = 'smaller' | 'balanced' | 'high'
export type VideoResolution = 'original' | 1080 | 720 | 480
export type VideoCodec = 'auto' | 'h264' | 'vp8'

export type QueueStatus =
  | 'ready'
  | 'loading-engine'
  | 'converting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface DetectedFile {
  format: InputMediaFormat
  kind: MediaKind
  mimeType: string
  extension: string
}

export interface ConversionOptions {
  outputFormat: MediaFormat
  audioBitrate: AudioBitrate
  audioChannels: AudioChannels
  audioSampleRate: AudioSampleRate
  videoQuality: VideoQuality
  videoResolution: VideoResolution
  videoCodec: VideoCodec
}

export interface QueueItem {
  id: string
  file: File
  detected: DetectedFile
  options: ConversionOptions
  status: QueueStatus
  progress: number
  phaseLabel?: string
  outputName?: string
  outputBlob?: Blob
  outputUrl?: string
  error?: string
  warning?: string
  sourceWidth?: number
  sourceHeight?: number
  sourceDurationSeconds?: number
  durationMs?: number
}

export interface ConversionEngine {
  convert(
    file: File,
    detected: DetectedFile,
    options: ConversionOptions,
    signal: AbortSignal,
    onProgress: (progress: number | null, label?: string) => void,
  ): Promise<Blob>
  cancel?(): void
  dispose?(): void
}
