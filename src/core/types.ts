export type ImageFormat = 'png' | 'jpg' | 'webp'
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'opus'
export type VideoFormat = 'mp4' | 'webm'
export type MediaFormat = ImageFormat | AudioFormat | VideoFormat
export type MediaKind = 'image' | 'audio' | 'video'
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
  format: MediaFormat
  kind: MediaKind
  mimeType: string
  extension: string
}

export interface ConversionOptions {
  outputFormat: MediaFormat
  quality: number
  width?: number
  height?: number
  lockAspectRatio: boolean
  preventUpscale: boolean
  jpgBackgroundColor: string
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
  resultWidth?: number
  resultHeight?: number
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
