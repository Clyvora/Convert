import { describe, expect, it } from 'vitest'
import { buildMediaArguments, getMediaMimeType } from './options'
import type { LocalMediaConversionOptions } from './types'

const defaults: LocalMediaConversionOptions = {
  outputFormat: 'mp3',
  audioBitrate: 192,
  audioChannels: 'source',
  audioSampleRate: 'source',
  videoQuality: 'balanced',
  videoResolution: 'original',
  videoCodec: 'auto',
}

describe('local media FFmpeg arguments', () => {
  it('extracts MP3 audio with the selected bitrate', () => {
    const args = buildMediaArguments('/input.mp4', '/output.mp3', 'mp4', defaults)
    expect(args).toContain('libmp3lame')
    expect(args).toContain('192k')
    expect(args).toContain('-vn')
  })

  it('creates compatible MP4 video without upscaling past the selected limit', () => {
    const args = buildMediaArguments('/input.webm', '/output.mp4', 'webm', {
      ...defaults,
      outputFormat: 'mp4',
      videoResolution: 720,
      videoQuality: 'high',
    })
    expect(args).toContain('libx264')
    expect(args).toContain("scale=w='min(iw,1280)':h='min(ih,720)':force_original_aspect_ratio=decrease:force_divisible_by=2")
    expect(args).toContain('+faststart')
  })

  it('creates VP9 and Opus WebM output', () => {
    const args = buildMediaArguments('/input.mp4', '/output.webm', 'mp4', { ...defaults, outputFormat: 'webm' })
    expect(args).toContain('libvpx-vp9')
    expect(args).toContain('libopus')
  })

  it('rejects unsupported media pairs and reports MIME types', () => {
    expect(() => buildMediaArguments('/input.mp3', '/output.mp4', 'mp3', { ...defaults, outputFormat: 'mp4' })).toThrow(/supported output/i)
    expect(getMediaMimeType('opus')).toContain('opus')
    expect(getMediaMimeType('webm')).toBe('video/webm')
  })
})
