import { describe, expect, it } from 'vitest'
import { dimensionsFromHeight, dimensionsFromWidth, inspectEncodedImage, LIMITS, validateOutput } from './image'

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

describe('safe encoded image inspection', () => {
  it('reads PNG dimensions before decoding', () => {
    expect(inspectEncodedImage(png(1600, 900))).toEqual({ format: 'png', mimeType: 'image/png', width: 1600, height: 900 })
  })

  it('rejects a partial PNG lookalike instead of decoding it', () => {
    const lookalike = png(1600, 900)
    lookalike[7] = 0
    expect(() => inspectEncodedImage(lookalike)).toThrow(/valid PNG, JPEG, or WebP/i)
  })

  it('rejects decompression-bomb dimensions before browser decoding', () => {
    expect(() => inspectEncodedImage(png(10_000, 10_000))).toThrow(/more than 40 million pixels/i)
    expect(() => inspectEncodedImage(png(LIMITS.maxSourceDimension + 1, 10))).toThrow(/source dimensions/i)
  })

  it('enforces output dimension, pixel, and memory limits', () => {
    const source = inspectEncodedImage(png(4000, 3000))
    expect(() => validateOutput(9000, 100, source, 8)).toThrow(/8[.,]192 pixels/i)
    expect(() => validateOutput(8000, 8000, source, 8)).toThrow(/32 million pixels/i)
    expect(() => validateOutput(7000, 4000, source, 2)).toThrow(/memory/i)
  })

  it('calculates aspect-locked dimensions', () => {
    const source = inspectEncodedImage(png(1600, 900))
    expect(dimensionsFromWidth(source, 800)).toEqual({ width: 800, height: 450 })
    expect(dimensionsFromHeight(source, 450)).toEqual({ width: 800, height: 450 })
  })
})
