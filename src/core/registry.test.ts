import { describe, expect, it } from 'vitest'
import { getOutputFormats, isAudioFormat, isSupportedPair, isVideoFormat } from './registry'
import type { MediaFormat } from './types'

describe('media conversion registry', () => {
  it.each([
    ['mp3', 'wav'], ['wav', 'mp3'], ['ogg', 'opus'], ['opus', 'mp3'],
    ['mp4', 'webm'], ['mp4', 'mp3'], ['webm', 'mp4'], ['webm', 'opus'],
  ] satisfies Array<[MediaFormat, MediaFormat]>)('supports %s to %s', (input, output) => {
    expect(isSupportedPair(input, output)).toBe(true)
  })

  it('exposes no image formats', () => {
    expect(Object.keys({ mp3: 1, wav: 1, ogg: 1, opus: 1, mp4: 1, webm: 1 })).toHaveLength(6)
    expect(getOutputFormats('wav')).toEqual(['mp3', 'ogg', 'opus'])
    expect(getOutputFormats('mp4')).toEqual(['webm', 'mp3', 'wav', 'ogg', 'opus'])
    expect(isAudioFormat('wav')).toBe(true)
    expect(isVideoFormat('mp4')).toBe(true)
  })
})

