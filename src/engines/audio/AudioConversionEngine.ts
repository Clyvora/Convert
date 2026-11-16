import type { ConversionEngine, ConversionOptions, DetectedFile } from '../../core/types'
import { LocalMediaFfmpegEngine } from './AudioFfmpegEngine'

export class MediaConversionEngine implements ConversionEngine {
  // The local queue is sequential; audio and video can share the loaded worker.
  private readonly engine = new LocalMediaFfmpegEngine()

  prepare(detected: DetectedFile, options: ConversionOptions): Promise<void> {
    return this.engine.prepare(detected.format, options.outputFormat)
  }

  async convert(
    file: File,
    detected: DetectedFile,
    options: ConversionOptions,
    signal: AbortSignal,
    onProgress: (progress: number | null, label?: string) => void,
  ): Promise<Blob> {
    const result = await this.engine.convert(file, detected.format, {
      outputFormat: options.outputFormat,
      audioBitrate: options.audioBitrate,
      audioChannels: options.audioChannels,
      audioSampleRate: options.audioSampleRate,
      videoQuality: options.videoQuality,
      videoResolution: options.videoResolution,
      videoCodec: options.videoCodec,
      signal,
      onProgress: ({ phase, progress }) => onProgress(progress, phase === 'loading-engine' ? 'Loading local media engine' : `Converting ${detected.kind}`),
    })
    return result.blob
  }

  cancel(): void { this.engine.cancel() }
  dispose(): void { this.engine.dispose() }
}

export { MediaConversionEngine as AudioConversionEngine }
