export type ImageFormat = 'png' | 'jpg' | 'webp'
export type AudioFormat = 'mp3' | 'wav'
export type MediaFormat = ImageFormat | AudioFormat
export type MediaKind = 'image' | 'audio'

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
  jpgBackgroundColor: string
  mp3Bitrate: 128 | 192 | 256 | 320
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
}

export interface ConversionEngine {
  convert(
    file: File,
    options: ConversionOptions,
    signal: AbortSignal,
    onProgress: (progress: number | null, label?: string) => void,
  ): Promise<Blob>
  cancel?(): void
  dispose?(): void
}
