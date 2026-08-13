export const MP3_BITRATES = [128, 192, 256, 320] as const

export function validateQuality(value: number): number {
  if (!Number.isFinite(value)) return 0.9
  return Math.min(1, Math.max(0.1, value))
}

export function validateBitrate(value: number): (typeof MP3_BITRATES)[number] {
  if (MP3_BITRATES.includes(value as (typeof MP3_BITRATES)[number])) {
    return value as (typeof MP3_BITRATES)[number]
  }
  return 192
}
