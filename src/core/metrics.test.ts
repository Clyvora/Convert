import { describe, expect, it } from 'vitest'
import { assessMemoryRisk, calculateSizeChange, formatDuration } from './metrics'

describe('conversion metrics', () => {
  it('classifies lightweight and unusually large work', () => {
    expect(assessMemoryRisk(1024, 'image').level).toBe('light')
    expect(assessMemoryRisk(80 * 1024 ** 2, 'image').level).toBe('heavy')
  })

  it('calculates signed output size changes', () => {
    expect(calculateSizeChange(100, 60)).toBe(-40)
    expect(calculateSizeChange(100, 140)).toBe(40)
    expect(calculateSizeChange(0, 10)).toBeNull()
  })

  it('formats conversion duration', () => {
    expect(formatDuration(250)).toBe('250 ms')
    expect(formatDuration(1250)).toBe('1.3 s')
  })
})
