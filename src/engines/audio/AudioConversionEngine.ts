import type { ConversionEngine, ConversionOptions } from '../../core/types'
import { AudioFfmpegEngine } from './AudioFfmpegEngine'

/** Shared engine adapter around the reusable, worker-backed FFmpeg instance. */
export class AudioConversionEngine implements ConversionEngine {
  private readonly engine = new AudioFfmpegEngine()

  async convert(
    file: File,
    options: ConversionOptions,
    signal: AbortSignal,
    onProgress: (progress: number | null, label?: string) => void,
  ): Promise<Blob> {
    const inputFormat = options.outputFormat === 'mp3' ? 'wav' : 'mp3'
    const result = await this.engine.convert(file, inputFormat, {
      outputFormat: options.outputFormat as 'mp3' | 'wav',
      bitrateKbps: options.mp3Bitrate,
      signal,
      onProgress: ({ phase, progress }) => onProgress(
        progress,
        phase === 'loading-engine' ? 'Loading audio engine' : 'Converting audio',
      ),
    })
    return result.blob
  }

  cancel(): void { this.engine.cancel() }
  dispose(): void { this.engine.dispose() }
}
