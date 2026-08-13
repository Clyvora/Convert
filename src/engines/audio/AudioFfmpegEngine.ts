import type { MediaFormat } from '../../core/types'
import { canUseMultithreadCore, getFfmpegAssetUrls } from './ffmpegAssets'
import { buildMediaArguments, getMediaMimeType, isLocalMediaFormat } from './options'
import { AudioConversionError } from './types'
import type {
  LocalMediaConversionOptions,
  LocalMediaConversionResult,
  LocalMediaEngineMode,
  LocalMediaProgress,
} from './types'

type FfmpegInstance = InstanceType<(typeof import('@ffmpeg/ffmpeg'))['FFmpeg']>
type ProgressCallback = (event: { progress: number; time: number }) => void

/** Lazy, reusable worker-backed FFmpeg converter for audio and video. */
export class LocalMediaFfmpegEngine {
  private ffmpeg: FfmpegInstance | null = null
  private mode: LocalMediaEngineMode | null = null
  private loading: Promise<void> | null = null
  private active = false
  private cancelled = false

  get isLoaded(): boolean { return this.ffmpeg?.loaded === true }
  get engineMode(): LocalMediaEngineMode | null { return this.mode }

  async convert(
    file: File,
    inputFormat: MediaFormat,
    options: LocalMediaConversionOptions,
  ): Promise<LocalMediaConversionResult> {
    if (this.active) {
      throw new AudioConversionError('conversion-failed', 'The local media engine is already processing another file.')
    }
    if (!isLocalMediaFormat(inputFormat)) {
      throw new AudioConversionError('invalid-options', 'The selected file is not supported by the local media engine.')
    }

    this.throwIfAborted(options.signal)
    this.active = true
    this.cancelled = false
    let jobDirectory: string | null = null
    let mountedDirectory: string | null = null
    let outputPath: string | null = null
    let progressCallback: ProgressCallback | null = null
    let currentFfmpeg: FfmpegInstance | null = null

    try {
      await this.ensureLoaded(options.signal, options.onProgress)
      this.throwIfAborted(options.signal)
      currentFfmpeg = this.ffmpeg
      if (!currentFfmpeg || !this.mode) throw new AudioConversionError('engine-load-failed', 'The local media engine did not initialize.')

      const jobId = crypto.randomUUID().replaceAll('-', '')
      jobDirectory = `/job-${jobId}`
      mountedDirectory = `${jobDirectory}/source`
      const inputPath = `${mountedDirectory}/input.${inputFormat}`
      outputPath = `${jobDirectory}/output.${options.outputFormat}`
      const arguments_ = buildMediaArguments(inputPath, outputPath, inputFormat, options)

      await currentFfmpeg.createDir(jobDirectory, { signal: options.signal })
      await currentFfmpeg.createDir(mountedDirectory, { signal: options.signal })
      const { FFFSType } = await import('@ffmpeg/ffmpeg')
      await currentFfmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: `input.${inputFormat}`, data: file }] }, mountedDirectory)

      progressCallback = ({ progress }) => {
        if (Number.isFinite(progress)) this.report(options.onProgress, 'converting', Math.min(1, Math.max(0, progress)))
      }
      currentFfmpeg.on('progress', progressCallback)
      this.report(options.onProgress, 'converting', 0)
      const exitCode = await currentFfmpeg.exec(arguments_, -1, { signal: options.signal })
      this.throwIfAborted(options.signal)
      if (exitCode !== 0) throw new AudioConversionError('conversion-failed', `The local media engine stopped with code ${exitCode}.`)

      const bytes = await currentFfmpeg.readFile(outputPath, 'binary', { signal: options.signal })
      if (typeof bytes === 'string') throw new AudioConversionError('conversion-failed', 'The local media engine returned an invalid result.')
      const mimeType = getMediaMimeType(options.outputFormat)
      this.report(options.onProgress, 'converting', 1)
      return {
        blob: new Blob([new Uint8Array(bytes)], { type: mimeType }),
        format: options.outputFormat,
        mimeType,
        engineMode: this.mode,
      }
    } catch (error) {
      if (this.cancelled || options.signal?.aborted || isAbortError(error)) {
        throw new AudioConversionError('cancelled', 'Media conversion was cancelled.', { cause: error })
      }
      if (error instanceof AudioConversionError) throw error
      throw new AudioConversionError('conversion-failed', 'This media file could not be converted. It may be damaged or use an unsupported codec.', { cause: error })
    } finally {
      if (currentFfmpeg?.loaded) {
        if (progressCallback) currentFfmpeg.off('progress', progressCallback)
        await this.cleanup(currentFfmpeg, jobDirectory, mountedDirectory, outputPath)
      }
      this.active = false
    }
  }

  cancel(): void {
    if (!this.active && !this.loading) return
    this.cancelled = true
    this.reset()
  }

  dispose(): void { this.cancelled = true; this.reset() }

  private async ensureLoaded(signal: AbortSignal | undefined, onProgress: LocalMediaConversionOptions['onProgress']): Promise<void> {
    if (this.ffmpeg?.loaded) return
    if (this.loading) return this.loading
    this.report(onProgress, 'loading-engine', null)
    this.loading = this.loadBestCore(signal)
    try { await this.loading } finally { this.loading = null }
  }

  private async loadBestCore(signal: AbortSignal | undefined): Promise<void> {
    const preferredMode: LocalMediaEngineMode = canUseMultithreadCore() ? 'multi-thread' : 'single-thread'
    try {
      await this.loadCore(preferredMode, signal)
    } catch (preferredError) {
      if (signal?.aborted || this.cancelled || preferredMode === 'single-thread') {
        this.reset()
        throw new AudioConversionError(signal?.aborted || this.cancelled ? 'cancelled' : 'engine-load-failed', signal?.aborted || this.cancelled ? 'Media conversion was cancelled.' : 'The local media engine could not be loaded.', { cause: preferredError })
      }
      this.reset()
      try { await this.loadCore('single-thread', signal) } catch (fallbackError) {
        this.reset()
        throw new AudioConversionError(signal?.aborted || this.cancelled ? 'cancelled' : 'engine-load-failed', signal?.aborted || this.cancelled ? 'Media conversion was cancelled.' : 'The local media engine could not be loaded.', { cause: fallbackError })
      }
    }
  }

  private async loadCore(mode: LocalMediaEngineMode, signal: AbortSignal | undefined): Promise<void> {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    this.throwIfAborted(signal)
    const instance = new FFmpeg()
    this.ffmpeg = instance
    this.mode = mode
    await instance.load(getFfmpegAssetUrls(mode), { signal })
  }

  private async cleanup(ffmpeg: FfmpegInstance, jobDirectory: string | null, mountedDirectory: string | null, outputPath: string | null): Promise<void> {
    if (!jobDirectory) return
    if (mountedDirectory) await ignoreCleanupError(ffmpeg.unmount(mountedDirectory))
    if (outputPath) await ignoreCleanupError(ffmpeg.deleteFile(outputPath))
    if (mountedDirectory) await ignoreCleanupError(ffmpeg.deleteDir(mountedDirectory))
    await ignoreCleanupError(ffmpeg.deleteDir(jobDirectory))
  }

  private reset(): void {
    this.ffmpeg?.terminate()
    this.ffmpeg = null
    this.mode = null
    this.loading = null
  }

  private throwIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted || this.cancelled) throw new DOMException('Media conversion was cancelled.', 'AbortError')
  }

  private report(callback: LocalMediaConversionOptions['onProgress'], phase: LocalMediaProgress['phase'], progress: number | null): void {
    callback?.({ phase, progress })
  }
}

export { LocalMediaFfmpegEngine as AudioFfmpegEngine }

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function ignoreCleanupError(operation: Promise<unknown>): Promise<void> {
  try { await operation } catch { /* A missing temporary path is already clean. */ }
}
