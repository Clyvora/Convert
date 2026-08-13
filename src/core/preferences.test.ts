import { describe, expect, it } from 'vitest'
import { applyCompatibleSettings, mergePreferences, preferenceSubset } from './preferences'
import { defaultOptions } from './defaults'

describe('local conversion preferences', () => {
  it('ignores an incompatible remembered output', () => {
    expect(mergePreferences('png', { png: { outputFormat: 'wav' } }).outputFormat).toBe('jpg')
  })

  it('migrates obsolete remembered video codecs to automatic selection', () => {
    const saved = { webm: { videoCodec: 'vp9' } } as never
    expect(mergePreferences('webm', saved).videoCodec).toBe('auto')
  })

  it('copies image settings but keeps an incompatible target output', () => {
    const source = { ...defaultOptions('png'), outputFormat: 'jpg' as const, quality: 0.7, width: 800 }
    const target = defaultOptions('jpg')
    const applied = applyCompatibleSettings(source, 'jpg', target)
    expect(applied.outputFormat).toBe(target.outputFormat)
    expect(applied.quality).toBe(0.7)
    expect(applied.width).toBe(800)
  })

  it('stores only durable preferences, not one-off resize dimensions', () => {
    const subset = preferenceSubset({ ...defaultOptions('png'), width: 1200, height: 800 })
    expect(subset).not.toHaveProperty('width')
    expect(subset).not.toHaveProperty('height')
  })
})
