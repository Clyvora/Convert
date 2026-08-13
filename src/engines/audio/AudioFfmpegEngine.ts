import { canUseMultithreadCore, getFfmpegAssetUrls } from './ffmpegAssets'
import { DEFAULT_MP3_BITRATE, getAudioMimeType, isAudioFormat, isMp3Bitrate } from './options'
import { AudioConversionError } from './types'
import type {
  AudioConversionOptions,
  AudioConversionResult,
  AudioEngineMode,
  AudioProgress,
} from './types'

type FfmpegInstance = InstanceType<(typeof import('@ffmpeg/ffmpeg'))['FFmpeg']>
type ProgressCallback = (event: { progress: number; time: number }) => void

const SAFE_INPUT_NAMES = {
  mp3: 'input.mp3',
  wav: 'input.wav',
} as const

/**
 * Lazy, reusable FFmpeg audio converter. No @ffmpeg module is evaluated until
 * an audio conversion begins. The mounted File is read by WORKERFS to avoid an
 * extra full-file ArrayBuffer in application memory.
 */
export class AudioFfmpegEngine {
  private ffmpeg: FfmpegInstance | null = null
  private mode: AudioEngineMode | null = null
  private loading: Promise<void> | null = null
  private active = false
  private cancelled = false

  get isLoaded(): boolean {
    return this.ffmpeg?.loaded === true
  }

  get engineMode(): AudioEngineMode | null {
    return this.mode
  }

  async convert(
    file: File,
    inputFormat: 'mp3' | 'wav',
    options: AudioConversionOptions,
  ): Promise<AudioConversionResult> {
    if (this.active) {
      throw new AudioConversionError(
        'conversion-failed',
        'The audio engine is already converting another file. Process audio files sequentially.',
      )
    }

    this.validateOptions(inputFormat, options)
    this.throwIfAborted(options.signal)
    this.active = true
    this.cancelled = false

    let jobDirectory: string | null = null
    let mountedDirectory: string | null = null
    let progressCallback: ProgressCallback | null = null
    let currentFfmpeg: FfmpegInstance | null = null

    try {
      await this.ensureLoaded(options.signal, options.onProgress)
      this.throwIfAborted(options.signal)

      currentFfmpeg = this.ffmpeg
      if (!currentFfmpeg || !this.mode) {
        throw new AudioConversionError('engine-load-failed', 'The local audio engine did not initialize.')
      }

      const jobId = crypto.randomUUID().replaceAll('-', '')
      jobDirectory = `/job-${jobId}`
      mountedDirectory = `${jobDirectory}/source`
      const inputPath = `${mountedDirectory}/${SAFE_INPUT_NAMES[inputFormat]}`
      const outputPath = `${jobDirectory}/output.${options.outputFormat}`

      await currentFfmpeg.createDir(jobDirectory, { signal: options.signal })
      await currentFfmpeg.createDir(mountedDirectory, { signal: options.signal })
      const { FFFSType } = await import('@ffmpeg/ffmpeg')
      await currentFfmpeg.mount(
        FFFSType.WORKERFS,
        { blobs: [{ name: SAFE_INPUT_NAMES[inputFormat], data: file }] },
        mountedDirectory,
      )

      progressCallback = ({ progress }) => {
        if (Number.isFinite(progress)) {
          this.report(options.onProgress, 'converting', Math.min(1, Math.max(0, progress)))
        }
      }
      currentFfmpeg.on('progress', progressCallback)
      this.report(options.onProgress, 'converting', 0)

      const exitCode = await currentFfmpeg.exec(
        this.buildArguments(inputPath, outputPath, options),
        -1,
        { signal: options.signal },
      )
      this.throwIfAborted(options.signal)

      if (exitCode !== 0) {
        throw new AudioConversionError(
          'conversion-failed',
          `The audio engine stopped with code ${exitCode}. The file may be damaged or unsupported.`,
        )
      }

      const bytes = await currentFfmpeg.readFile(outputPath, 'binary', { signal: options.signal })
      if (typeof bytes === 'string') {
        throw new AudioConversionError('conversion-failed', 'The audio engine returned an invalid result.')
      }

      const outputBytes = new Uint8Array(bytes)
      const result: AudioConversionResult = {
        blob: new Blob([outputBytes], { type: getAudioMimeType(options.outputFormat) }),
        format: options.outputFormat,
        mimeType: getAudioMimeType(options.outputFormat),
        engineMode: this.mode,
      }
      this.report(options.onProgress, 'converting', 1)
      return result
    } catch (error) {
      if (this.cancelled || options.signal?.aborted || isAbortError(error)) {
        throw new AudioConversionError('cancelled', 'Audio conversion was cancelled.', { cause: error })
      }
      if (error instanceof AudioConversionError) {
        throw error
      }
      throw new AudioConversionError(
        'conversion-failed',
        'This audio file could not be converted. It may be damaged or use an unsupported codec.',
        { cause: error },
      )
    } finally {
      if (currentFfmpeg?.loaded) {
        if (progressCallback) currentFfmpeg.off('progress', progressCallback)
        await this.cleanup(currentFfmpeg, jobDirectory, mountedDirectory)
      }
      this.active = false
    }
  }

  /** Stops current work immediately. The engine is recreated on the next job. */
  cancel(): void {
    if (!this.active && !this.loading) return
    this.cancelled = true
    this.reset()
  }

  dispose(): void {
    this.cancelled = true
    this.reset()
  }

  private async ensureLoaded(
    signal: AbortSignal | undefined,
    onProgress: AudioConversionOptions['onProgress'],
  ): Promise<void> {
    if (this.ffmpeg?.loaded) return
    if (this.loading) return this.loading

    this.report(onProgress, 'loading-engine', null)
    this.loading = this.loadBestCore(signal)
    try {
      await this.loading
    } finally {
      this.loading = null
    }
  }

  private async loadBestCore(signal: AbortSignal | undefined): Promise<void> {
    const preferredMode: AudioEngineMode = canUseMultithreadCore()
      ? 'multi-thread'
      : 'single-thread'

    try {
      await this.loadCore(preferredMode, signal)
    } catch (preferredError) {
      if (signal?.aborted || this.cancelled || preferredMode === 'single-thread') {
        this.reset()
        throw new AudioConversionError(
          signal?.aborted || this.cancelled ? 'cancelled' : 'engine-load-failed',
          signal?.aborted || this.cancelled
            ? 'Audio conversion was cancelled.'
            : 'The local audio engine could not be loaded. Refresh the page and try again.',
          { cause: preferredError },
        )
      }

      // A browser can expose SharedArrayBuffer while still blocking the pthread
      // worker. Recover transparently with the more compatible single core.
      this.reset()
      try {
        await this.loadCore('single-thread', signal)
      } catch (fallbackError) {
        this.reset()
        throw new AudioConversionError(
          signal?.aborted || this.cancelled ? 'cancelled' : 'engine-load-failed',
          signal?.aborted || this.cancelled
            ? 'Audio conversion was cancelled.'
            : 'The local audio engine could not be loaded. Refresh the page and try again.',
          { cause: fallbackError },
        )
      }
    }
  }

  private async loadCore(mode: AudioEngineMode, signal: AbortSignal | undefined): Promise<void> {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    this.throwIfAborted(signal)
    const instance = new FFmpeg()
    this.ffmpeg = instance
    this.mode = mode
    await instance.load(getFfmpegAssetUrls(mode), { signal })
  }

  private buildArguments(
    inputPath: string,
    outputPath: string,
    options: AudioConversionOptions,
  ): string[] {
    if (options.outputFormat === 'mp3') {
      const bitrate = options.bitrateKbps ?? DEFAULT_MP3_BITRATE
      return [
        '-i', inputPath,
        '-map_metadata', '-1',
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', `${bitrate}k`,
        outputPath,
      ]
    }

    return [
      '-i', inputPath,
      '-map_metadata', '-1',
      '-vn',
      '-c:a', 'pcm_s16le',
      outputPath,
    ]
  }

  private validateOptions(inputFormat: 'mp3' | 'wav', options: AudioConversionOptions): void {
    if (!isAudioFormat(options.outputFormat) || inputFormat === options.outputFormat) {
      throw new AudioConversionError('invalid-options', 'Choose the other supported audio format.')
    }
    if (options.outputFormat === 'mp3' && !isMp3Bitrate(options.bitrateKbps ?? DEFAULT_MP3_BITRATE)) {
      throw new AudioConversionError(
        'invalid-options',
        'Choose an MP3 bitrate of 128, 192, 256, or 320 kbps.',
      )
    }
  }

  private async cleanup(
    ffmpeg: FfmpegInstance,
    jobDirectory: string | null,
    mountedDirectory: string | null,
  ): Promise<void> {
    if (!jobDirectory) return
    if (mountedDirectory) await ignoreCleanupError(ffmpeg.unmount(mountedDirectory))
    await ignoreCleanupError(ffmpeg.deleteFile(`${jobDirectory}/output.mp3`))
    await ignoreCleanupError(ffmpeg.deleteFile(`${jobDirectory}/output.wav`))
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
    if (signal?.aborted || this.cancelled) {
      throw new DOMException('Audio conversion was cancelled.', 'AbortError')
    }
  }

  private report(
    callback: AudioConversionOptions['onProgress'],
    phase: AudioProgress['phase'],
    progress: number | null,
  ): void {
    callback?.({ phase, progress })
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function ignoreCleanupError(operation: Promise<unknown>): Promise<void> {
  try {
    await operation
  } catch {
    // A missing temporary path is already clean; cleanup must never mask the result.
  }
}
