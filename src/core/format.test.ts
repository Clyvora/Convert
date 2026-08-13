import { describe, expect, it } from 'vitest'

import { formatBytes } from './format'

describe('byte-size formatting', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [10 * 1024, '10 KB'],
    [1536 * 1024, '1.5 MB'],
    [2 * 1024 ** 3, '2.0 GB'],
  ])('formats %d bytes as %s', (value, expected) => {
    expect(formatBytes(value)).toBe(expected)
  })

  it('returns a non-numeric placeholder for invalid sizes', () => {
    expect(formatBytes(-1)).not.toMatch(/-1/)
    expect(formatBytes(Number.NaN)).not.toMatch(/NaN/)
    expect(formatBytes(Number.POSITIVE_INFINITY)).not.toMatch(/Infinity/)
  })
})
