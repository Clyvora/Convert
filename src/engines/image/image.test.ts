import { describe, expect, it } from 'vitest'

import {
  calculateAspectLockedDimensions,
  calculateOutputDimensions,
  getImageRenderPlan,
  normalizeJpegBackgroundColor,
  validateCanvasDimensions,
  validateImageQuality,
} from './index'

describe('image dimension calculations', () => {
  it('preserves the source dimensions by default', () => {
    expect(calculateOutputDimensions(1920, 1080)).toEqual({ width: 1920, height: 1080 })
  })

  it('derives height from width while aspect ratio is locked', () => {
    expect(calculateOutputDimensions(4000, 3000, { width: 1000 })).toEqual({
      width: 1000,
      height: 750,
    })
  })

  it('derives width from height while aspect ratio is locked', () => {
    expect(calculateAspectLockedDimensions(1600, 900, 'height', 450)).toEqual({
      width: 800,
      height: 450,
    })
  })

  it('fits a locked image inside a two-dimensional bounding box without cropping', () => {
    expect(calculateOutputDimensions(1600, 900, { width: 500, height: 500 })).toEqual({
      width: 500,
      height: 281,
    })
  })

  it('uses independent dimensions when aspect lock is disabled', () => {
    expect(calculateOutputDimensions(1600, 900, {
      width: 500,
      height: 500,
      lockAspectRatio: false,
    })).toEqual({ width: 500, height: 500 })
  })

  it('prevents accidental enlargement when requested', () => {
    expect(calculateOutputDimensions(800, 600, {
      width: 1600,
      lockAspectRatio: true,
      preventUpscale: true,
    })).toEqual({ width: 800, height: 600 })
  })

  it('rejects invalid and browser-unsafe canvas dimensions', () => {
    expect(() => calculateOutputDimensions(100, 100, { width: 0 })).toThrow(/positive whole number/i)
    expect(() => validateCanvasDimensions(32768, 1)).toThrow(/canvas limit/i)
    expect(() => validateCanvasDimensions(20000, 20000)).toThrow(/too much canvas memory/i)
  })
})

describe('image quality and transparency behavior', () => {
  it('uses format defaults and accepts boundary quality values', () => {
    expect(validateImageQuality('jpg')).toBe(0.92)
    expect(validateImageQuality('webp')).toBe(0.9)
    expect(validateImageQuality('jpg', 0)).toBe(0)
    expect(validateImageQuality('webp', 1)).toBe(1)
  })

  it('ignores quality for lossless PNG and rejects invalid lossy quality', () => {
    expect(validateImageQuality('png', 2)).toBeUndefined()
    expect(() => validateImageQuality('jpg', Number.NaN)).toThrow(/0 to 1/i)
    expect(() => validateImageQuality('webp', 1.01)).toThrow(/0 to 1/i)
  })

  it('defaults transparent-to-JPEG rendering to an opaque white background', () => {
    expect(getImageRenderPlan('jpg')).toEqual({
      preserveTransparency: false,
      backgroundColor: '#ffffff',
    })
  })

  it('normalizes a selected JPEG background and preserves transparency otherwise', () => {
    expect(normalizeJpegBackgroundColor('#AbC')).toBe('#aabbcc')
    expect(getImageRenderPlan('jpg', '#123456')).toEqual({
      preserveTransparency: false,
      backgroundColor: '#123456',
    })
    expect(getImageRenderPlan('png')).toEqual({ preserveTransparency: true })
    expect(getImageRenderPlan('webp')).toEqual({ preserveTransparency: true })
  })

  it('rejects transparent or browser-dependent CSS JPEG background values', () => {
    expect(() => normalizeJpegBackgroundColor('#fff8')).toThrow(/opaque hex/i)
    expect(() => normalizeJpegBackgroundColor('white')).toThrow(/opaque hex/i)
  })
})
