import { describe, expect, it } from 'vitest'
import { outputFilename, uniqueFilename } from './naming'

describe('media output filenames', () => {
  it('replaces only the final extension and sanitizes reserved characters', () => {
    expect(outputFilename('session.final.WAV', 'mp3')).toBe('session.final.mp3')
    expect(outputFilename('bad:name?.wav', 'opus')).toBe('bad-name-.opus')
  })
  it('adds deterministic case-insensitive suffixes', () => {
    expect(uniqueFilename('TRACK.MP3', new Set(['track.mp3']))).toBe('TRACK (2).MP3')
  })
})

