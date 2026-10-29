import { isSupportedPair } from '../../core/registry'
import type { AudioFormat, InputMediaFormat, VideoFormat } from '../../core/types'
import { AUDIO_BITRATE_PRESETS, MP3_BITRATE_PRESETS } from './types'
import type { LocalMediaConversionOptions, LocalMediaFormat, Mp3Bitrate } from './types'

export const DEFAULT_MP3_BITRATE: Mp3Bitrate = 192

export function isMp3Bitrate(value: unknown): value is Mp3Bitrate {
  return typeof value === 'number' && MP3_BITRATE_PRESETS.some((preset) => preset === value)
}

export function isAudioBitrate(value: unknown): boolean {
  return typeof value === 'number' && AUDIO_BITRATE_PRESETS.some((preset) => preset === value)
}

export function isAudioFormat(value: unknown): value is AudioFormat {
  return value === 'mp3' || value === 'wav' || value === 'ogg' || value === 'opus' || value === 'm4a' || value === 'flac'
}

export function isVideoFormat(value: unknown): value is VideoFormat {
  return value === 'mp4' || value === 'webm' || value === 'mkv'
}

export function isLocalMediaFormat(value: unknown): value is LocalMediaFormat {
  return isAudioFormat(value) || isVideoFormat(value)
}

export function isLocalInputFormat(value: unknown): value is InputMediaFormat {
  return isLocalMediaFormat(value) || value === 'aac' || value === 'm4a' || value === 'ts'
}

export function getAudioMimeType(format: AudioFormat): string {
  return { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg; codecs=opus', m4a: 'audio/mp4', flac: 'audio/flac' }[format]
}

export function getMediaMimeType(format: LocalMediaFormat): string {
  if (isAudioFormat(format)) return getAudioMimeType(format)
  return format === 'mp4' ? 'video/mp4' : format === 'mkv' ? 'video/x-matroska' : 'video/webm'
}

function audioSettings(options: LocalMediaConversionOptions): string[] {
  const args: string[] = []
  if (options.audioChannels !== 'source') args.push('-ac', String(options.audioChannels))
  // Opus (including WebM's audio track) cannot encode 44.1 kHz.
  const sampleRate = (options.outputFormat === 'opus' || options.outputFormat === 'webm') && options.audioSampleRate === 44100
    ? 48000 : options.audioSampleRate
  if (sampleRate !== 'source') args.push('-ar', String(sampleRate))
  return args
}

function audioArguments(options: LocalMediaConversionOptions): string[] {
  const args = ['-vn']
  const codec = {
    mp3: 'libmp3lame',
    wav: 'pcm_s16le',
    ogg: 'libvorbis',
    opus: 'libopus',
    m4a: 'aac',
    flac: 'flac',
  }[options.outputFormat as AudioFormat]
  args.push('-c:a', codec)
  if (options.outputFormat !== 'wav' && options.outputFormat !== 'flac') args.push('-b:a', `${options.audioBitrate}k`)
  args.push(...audioSettings(options))
  return args
}

function videoScaleFilter(resolution: LocalMediaConversionOptions['videoResolution']): string[] {
  if (resolution === 'original') return []
  const width = resolution === 1080 ? 1920 : resolution === 720 ? 1280 : 854
  return ['-vf', `scale=w='min(iw,${width})':h='min(ih,${resolution})':force_original_aspect_ratio=decrease:force_divisible_by=2`]
}

function videoArguments(options: LocalMediaConversionOptions): string[] {
  const codec = options.videoCodec === 'auto'
    ? options.outputFormat === 'webm' ? 'vp8' : 'h264'
    : options.videoCodec
  if ((options.outputFormat === 'mp4' && codec !== 'h264') || (options.outputFormat === 'webm' && codec !== 'vp8')) {
    throw new TypeError(`The ${codec.toUpperCase()} codec is not available for ${options.outputFormat.toUpperCase()} output.`)
  }
  const crf = options.outputFormat !== 'webm'
    ? { smaller: '32', balanced: '26', high: '20' }[options.videoQuality]
    : { smaller: '42', balanced: '34', high: '27' }[options.videoQuality]
  const shared = ['-map', '0:v:0', '-map', '0:a?', ...videoScaleFilter(options.videoResolution), ...audioSettings(options)]
  if (codec === 'h264') {
    return [...shared, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', `${options.audioBitrate}k`, '-movflags', '+faststart']
  }
  const bitrate = { smaller: '500k', balanced: '1M', high: '2M' }[options.videoQuality]
  return [...shared, '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '5', '-crf', crf, '-b:v', bitrate, '-c:a', 'libopus', '-b:a', `${options.audioBitrate}k`]
}

export function buildMediaArguments(
  inputPath: string,
  outputPath: string,
  inputFormat: InputMediaFormat,
  options: LocalMediaConversionOptions,
): string[] {
  if (!isLocalInputFormat(inputFormat) || !isLocalMediaFormat(options.outputFormat) || !isSupportedPair(inputFormat, options.outputFormat)) {
    throw new TypeError('Choose a supported output format for this media file.')
  }
  if (!isAudioBitrate(options.audioBitrate)) throw new TypeError('Choose a supported audio bitrate.')
  return [
    '-i', inputPath,
    '-map_metadata', '-1',
    ...(isAudioFormat(options.outputFormat) ? audioArguments(options) : videoArguments(options)),
    outputPath,
  ]
}
