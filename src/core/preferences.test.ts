import { describe, expect, it } from 'vitest'
import { applyCompatibleSettings, mergePreferences, preferenceSubset } from './preferences'
import { defaultOptions } from './defaults'

describe('media preferences', () => {
  it('recovers from missing or malformed stored settings', () => {
    for (const value of [null, [], 'old settings', { wav: null }, { wav: { audioBitrate: 999, audioSampleRate: '44100', audioChannels: 8, videoResolution: -1, videoQuality: 'old' } }]) {
      expect(mergePreferences('wav', value as never)).toEqual(defaultOptions('wav'))
    }
  })
  it('ignores an incompatible remembered output', () => {
    expect(mergePreferences('mp3', { mp3: { outputFormat: 'mp4' } }).outputFormat).toBe('wav')
  })

  it('migrates obsolete remembered video codecs to automatic selection', () => {
    expect(mergePreferences('webm', { webm: { videoCodec: 'vp8' } }).videoCodec).toBe('auto')
  })

  it('copies compatible audio settings without forcing an invalid output', () => {
    const source = { ...defaultOptions('wav'), outputFormat: 'mp3' as const, audioBitrate: 320 as const }
    const applied = applyCompatibleSettings(source, 'ogg', defaultOptions('ogg'))
    expect(applied.outputFormat).toBe('mp3')
    expect(applied.audioBitrate).toBe(320)
  })

  it('stores only durable media settings', () => {
    expect(preferenceSubset(defaultOptions('mp4'))).toEqual(expect.objectContaining({
      outputFormat: 'webm', videoQuality: 'balanced', videoResolution: 'original',
    }))
  })
})

