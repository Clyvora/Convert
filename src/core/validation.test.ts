import { describe, expect, it } from 'vitest'

import { MP3_BITRATES, validateBitrate, validateQuality } from './validation'

describe('conversion option validation', () => {
  it('clamps image quality to the supported range', () => {
    expect(validateQuality(-1)).toBe(0.1)
    expect(validateQuality(0.65)).toBe(0.65)
    expect(validateQuality(2)).toBe(1)
  })

  it('uses a safe quality default for non-finite values', () => {
    expect(validateQuality(Number.NaN)).toBe(0.9)
    expect(validateQuality(Number.POSITIVE_INFINITY)).toBe(0.9)
  })

  it('accepts only the advertised MP3 bitrate presets', () => {
    for (const bitrate of MP3_BITRATES) expect(validateBitrate(bitrate)).toBe(bitrate)
    expect(validateBitrate(96)).toBe(192)
    expect(validateBitrate(Number.NaN)).toBe(192)
  })
})
