import { describe, expect, it } from 'vitest'

import { getOutputFormats, isAudioFormat, isImageFormat, isSupportedPair, isVideoFormat } from './registry'
import type { MediaFormat } from './types'

describe('conversion registry', () => {
  const supportedPairs: Array<[MediaFormat, MediaFormat]> = [
    ['png', 'jpg'],
    ['png', 'webp'],
    ['jpg', 'png'],
    ['jpg', 'webp'],
    ['webp', 'png'],
    ['webp', 'jpg'],
    ['mp3', 'wav'],
    ['wav', 'mp3'],
    ['ogg', 'opus'],
    ['opus', 'mp3'],
    ['mp4', 'webm'],
    ['mp4', 'mp3'],
    ['webm', 'mp4'],
    ['webm', 'opus'],
  ]

  it.each(supportedPairs)('supports %s to %s', (input, output) => {
    expect(isSupportedPair(input, output)).toBe(true)
  })

  it.each([
    ['png', 'png'],
    ['jpg', 'wav'],
    ['webp', 'mp3'],
    ['mp3', 'jpg'],
    ['wav', 'wav'],
  ] satisfies Array<[MediaFormat, MediaFormat]>)('rejects unsupported %s to %s', (input, output) => {
    expect(isSupportedPair(input, output)).toBe(false)
  })

  it('returns only the registered destinations and correctly classifies media kinds', () => {
    expect(getOutputFormats('png')).toEqual(['jpg', 'webp'])
    expect(getOutputFormats('wav')).toEqual(['mp3', 'ogg', 'opus'])
    expect(getOutputFormats('mp4')).toEqual(['webm', 'mp3', 'wav', 'ogg', 'opus'])
    expect(isImageFormat('webp')).toBe(true)
    expect(isImageFormat('mp3')).toBe(false)
    expect(isAudioFormat('wav')).toBe(true)
    expect(isAudioFormat('jpg')).toBe(false)
    expect(isVideoFormat('mp4')).toBe(true)
    expect(isVideoFormat('opus')).toBe(false)
  })
})
