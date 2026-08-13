import { describe, expect, it } from 'vitest'

import { getOutputFormats, isAudioFormat, isImageFormat, isSupportedPair } from './registry'
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
    expect(getOutputFormats('wav')).toEqual(['mp3'])
    expect(isImageFormat('webp')).toBe(true)
    expect(isImageFormat('mp3')).toBe(false)
    expect(isAudioFormat('wav')).toBe(true)
    expect(isAudioFormat('jpg')).toBe(false)
  })
})
