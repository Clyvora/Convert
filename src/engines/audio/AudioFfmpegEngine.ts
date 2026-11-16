import type { InputMediaFormat, MediaFormat } from '../../core/types'
import { canUseMultithreadCore, getFfmpegAssetUrls } from './ffmpegAssets'
import { buildMediaArguments, getMediaMimeType, isLocalInputFormat } from './options'
import { AudioConversionError } from './types'
import { LARGE_LOCAL_FILE_BYTES, validateLocalFileSize } from '../../core/localLimits'
import type {
  LocalMediaConversionOptions,
  LocalMediaConversionResult,
  LocalMediaEngineMode,
  LocalMediaProgress,
} from './types'

type FfmpegInstance = InstanceType<(typeof import('@ffmpeg/ffmpeg'))['FFmpeg']>
type ProgressCallback = (event: { progress: number; time: number }) => void
type LogCallback = (event: { type: string; message: string }) => void

/** Lazy, reusable worker-backed FFmpeg converter for audio and video. */
export class LocalMediaFfmpegEngine {
  private ffmpeg: FfmpegInstance | null = null
  private mode: LocalMediaEngineMode | null = null
  private loading: Promise<void> | null = null
  private active = false
  private cancelled = false
  private generation = 0

  get isLoaded(): boolean { return this.ffmpeg?.loaded === true }
  get engineMode(): LocalMediaEngineMode | null { return this.mode }

  /** Warm only after files are chosen. A conversion can join this initial load. */
  async prepare(inputFormat: InputMediaFormat, outputFormat: MediaFormat): Promise<void> {
    if(this.active || this.loading || this.ffmpeg?.loaded)return
    this.cancelled = false
    await this.ensureLoaded(undefined, undefined, requiredCore(inputFormat, outputFormat))
  }

  async convert(
    file: File,
    inputFormat: InputMediaFormat,
    options: LocalMediaConversionOptions,
  ): Promise<LocalMediaConversionResult> {
    if (this.active) {
      throw new AudioConversionError('conversion-failed', 'The local media engine is already processing another file.')
    }
    if (!isLocalInputFormat(inputFormat)) {
      throw new AudioConversionError('invalid-options', 'The selected file is not supported by the local media engine.')
    }
    try{validateLocalFileSize(file.size)}catch(error){throw new AudioConversionError('file-too-large',(error as Error).message,{cause:error})}

    this.cancelled = false
    this.throwIfAborted(options.signal)
    this.active = true
    let jobDirectory: string | null = null
    let mountedDirectory: string | null = null
    let outputPath: string | null = null
    let progressCallback: ProgressCallback | null = null
    let logCallback: LogCallback | null = null
    const diagnosticLog: string[] = []
    let currentFfmpeg: FfmpegInstance | null = null
    let releaseAfterJob = file.size >= LARGE_LOCAL_FILE_BYTES

    try {
      // The bundled multithreaded AAC build can stall. Use the verified single-thread core.
      await this.ensureLoaded(options.signal, options.onProgress, requiredCore(inputFormat, options.outputFormat))
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
      logCallback = ({ message }) => {
        diagnosticLog.push(message)
        if (diagnosticLog.length > 12) diagnosticLog.shift()
      }
      currentFfmpeg.on('log', logCallback)
      currentFfmpeg.on('progress', progressCallback)
      this.report(options.onProgress, 'converting', 0)
      const exitCode = await currentFfmpeg.exec(arguments_, -1, { signal: options.signal })
      this.throwIfAborted(options.signal)
      if (exitCode !== 0) throw new AudioConversionError('conversion-failed', `The local media engine stopped with code ${exitCode}.`, {
        cause: new Error(diagnosticLog.join('\n')),
      })

      const bytes = await currentFfmpeg.readFile(outputPath, 'binary', { signal: options.signal })
      if (typeof bytes === 'string') throw new AudioConversionError('conversion-failed', 'The local media engine returned an invalid result.')
      const mimeType = getMediaMimeType(options.outputFormat)
      releaseAfterJob ||= bytes.byteLength >= LARGE_LOCAL_FILE_BYTES
      this.report(options.onProgress, 'converting', 1)
      return {
        blob: new Blob([bytes.buffer instanceof ArrayBuffer ? bytes as Uint8Array<ArrayBuffer> : new Uint8Array(bytes)], { type: mimeType }),
        format: options.outputFormat,
        mimeType,
        engineMode: this.mode,
      }
    } catch (error) {
      if (this.cancelled || options.signal?.aborted || isAbortError(error)) {
        throw new AudioConversionError('cancelled', 'Media conversion was cancelled.', { cause: error })
      }
      if(isMemoryError(error,diagnosticLog)) {
        this.reset()
        throw new AudioConversionError('memory-limit', 'This conversion ran out of browser memory. Download and clear completed files, then try a smaller video resolution or a compressed audio format such as MP3. Your original file is unchanged.', {cause:error})
      }
      if (error instanceof AudioConversionError) throw error
      const details = [error instanceof Error ? `${error.name}: ${error.message}` : String(error), ...diagnosticLog].filter(Boolean).join('\n')
      throw new AudioConversionError('conversion-failed', 'This media file could not be converted. It may be damaged or use an unsupported codec.', { cause: new Error(details) })
    } finally {
      if (currentFfmpeg?.loaded) {
        if (progressCallback) currentFfmpeg.off('progress', progressCallback)
        if (logCallback) currentFfmpeg.off('log', logCallback)
        await this.cleanup(currentFfmpeg, jobDirectory, mountedDirectory, outputPath)
      }
      // WebAssembly memory cannot shrink. Reclaim a large job's worker before the next file.
      if(releaseAfterJob && currentFfmpeg && this.ffmpeg===currentFfmpeg)this.reset()
      this.active = false
    }
  }

  cancel(): void {
    if (!this.active && !this.loading) return
    this.cancelled = true
    this.reset()
  }

  dispose(): void { this.cancelled = true; this.reset() }

  private async ensureLoaded(signal: AbortSignal | undefined, onProgress: LocalMediaConversionOptions['onProgress'], requiredMode?: LocalMediaEngineMode): Promise<void> {
    if (this.loading) {
      this.report(onProgress, 'loading-engine', null)
      await this.loading
      this.throwIfAborted(signal)
    }
    if (this.ffmpeg?.loaded && (!requiredMode || this.mode === requiredMode)) return
    if (this.ffmpeg?.loaded && requiredMode && this.mode !== requiredMode) this.reset()
    this.report(onProgress, 'loading-engine', null)
    const loading = this.loadBestCore(signal, requiredMode)
    this.loading = loading
    try { await loading } finally { if(this.loading === loading)this.loading = null }
  }

  private async loadBestCore(signal: AbortSignal | undefined, requiredMode?: LocalMediaEngineMode): Promise<void> {
    const preferredMode: LocalMediaEngineMode = requiredMode ?? (canUseMultithreadCore() ? 'multi-thread' : 'single-thread')
    const generation = this.generation
    try {
      await this.loadCore(preferredMode, signal, generation)
    } catch (preferredError) {
      if(generation !== this.generation)throw new AudioConversionError('cancelled', 'Media conversion was cancelled.', { cause: preferredError })
      if (signal?.aborted || this.cancelled || preferredMode === 'single-thread') {
        this.reset()
        throw new AudioConversionError(signal?.aborted || this.cancelled ? 'cancelled' : 'engine-load-failed', signal?.aborted || this.cancelled ? 'Media conversion was cancelled.' : 'The local media engine could not be loaded.', { cause: preferredError })
      }
      this.reset(false)
      const fallbackGeneration = this.generation
      try { await this.loadCore('single-thread', signal, fallbackGeneration) } catch (fallbackError) {
        if(fallbackGeneration === this.generation)this.reset()
        throw new AudioConversionError(signal?.aborted || this.cancelled ? 'cancelled' : 'engine-load-failed', signal?.aborted || this.cancelled ? 'Media conversion was cancelled.' : 'The local media engine could not be loaded.', { cause: fallbackError })
      }
    }
  }

  private async loadCore(mode: LocalMediaEngineMode, signal: AbortSignal | undefined, generation: number): Promise<void> {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    this.throwIfAborted(signal)
    if(generation !== this.generation)throw new DOMException('Media engine loading was cancelled.', 'AbortError')
    const instance = new FFmpeg()
    this.ffmpeg = instance
    this.mode = mode
    await instance.load(getFfmpegAssetUrls(mode), { signal })
    if(generation !== this.generation)throw new DOMException('Media engine loading was cancelled.', 'AbortError')
  }

  private async cleanup(ffmpeg: FfmpegInstance, jobDirectory: string | null, mountedDirectory: string | null, outputPath: string | null): Promise<void> {
    if (!jobDirectory) return
    if (mountedDirectory) await ignoreCleanupError(ffmpeg.unmount(mountedDirectory))
    if (outputPath) await ignoreCleanupError(ffmpeg.deleteFile(outputPath))
    if (mountedDirectory) await ignoreCleanupError(ffmpeg.deleteDir(mountedDirectory))
    await ignoreCleanupError(ffmpeg.deleteDir(jobDirectory))
  }

  private reset(clearLoading = true): void {
    this.generation++
    this.ffmpeg?.terminate()
    this.ffmpeg = null
    this.mode = null
    if(clearLoading)this.loading = null
  }

  private throwIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted || this.cancelled) throw new DOMException('Media conversion was cancelled.', 'AbortError')
  }

  private report(callback: LocalMediaConversionOptions['onProgress'], phase: LocalMediaProgress['phase'], progress: number | null): void {
    callback?.({ phase, progress })
  }
}

export { LocalMediaFfmpegEngine as AudioFfmpegEngine }

function requiredCore(inputFormat: InputMediaFormat, outputFormat: MediaFormat): LocalMediaEngineMode | undefined {
  // Keep the verified single-thread path for video, AAC/M4A and FLAC.
  return ['mp4', 'webm', 'mkv', 'm4a', 'flac', 'aac', 'ts'].includes(inputFormat) || ['mp4', 'webm', 'mkv', 'm4a', 'flac'].includes(outputFormat) ? 'single-thread' : undefined
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isMemoryError(error: unknown, log: string[]): boolean {
  const details=[error instanceof Error?error.message:String(error),...log].join('\n')
  return /out of memory|out of bounds|allocation failed|cannot allocate memory|cannot enlarge memory|invalid typed array length|aborted\(oom\)/i.test(details)
}

async function ignoreCleanupError(operation: Promise<unknown>): Promise<void> {
  try { await operation } catch { /* A missing temporary path is already clean. */ }
}
