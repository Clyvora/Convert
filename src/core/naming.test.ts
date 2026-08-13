import { describe, expect, it } from 'vitest'

import { outputFilename, uniqueFilename } from './naming'

describe('output filenames', () => {
  it('replaces only the final extension', () => {
    expect(outputFilename('holiday.final.PNG', 'webp')).toBe('holiday.final.webp')
  })

  it('sanitizes reserved filename characters and supplies an empty-name fallback', () => {
    expect(outputFilename('bad:name?.png', 'jpg')).toBe('bad-name-.jpg')
    expect(outputFilename('...png', 'jpg')).toBe('converted.jpg')
  })

  it('preserves Unicode names after compatibility normalization', () => {
    expect(outputFilename('cafe\u0301.png', 'webp')).toBe('caf\u00e9.webp')
  })

  it('adds deterministic numeric suffixes without changing the extension', () => {
    const used = new Set(['photo.jpg', 'photo (2).jpg', 'photo (3).jpg'])
    expect(uniqueFilename('photo.jpg', used)).toBe('photo (4).jpg')
  })

  it('treats duplicate names case-insensitively', () => {
    expect(uniqueFilename('PHOTO.JPG', new Set(['photo.jpg']))).toBe('PHOTO (2).JPG')
  })
})
