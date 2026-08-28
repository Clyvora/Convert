import { describe, expect, it } from 'vitest'
import { assessMemoryRisk, calculateSizeChange, formatDuration } from './metrics'

describe('conversion metrics', () => {
  it('classifies lightweight and unusually large media', () => {
    expect(assessMemoryRisk(1024, 'audio').level).toBe('light')
    expect(assessMemoryRisk(300 * 1024 ** 2, 'video').level).toBe('heavy')
  })
  it('calculates size changes and duration', () => {
    expect(calculateSizeChange(100, 60)).toBe(-40)
    expect(calculateSizeChange(0, 10)).toBeNull()
    expect(formatDuration(1250)).toBe('1.3 s')
  })
})

