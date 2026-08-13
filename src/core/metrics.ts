export type MemoryRisk = 'light' | 'moderate' | 'heavy'

export interface MemoryAssessment {
  level: MemoryRisk
  label: string
  detail: string
}

export function assessMemoryRisk(bytes: number, kind: 'image' | 'audio', deviceMemory?: number): MemoryAssessment {
  const estimatedWorkingBytes = bytes * (kind === 'image' ? 6 : 4)
  const availableBytes = deviceMemory ? deviceMemory * 1024 ** 3 : undefined
  const ratio = availableBytes ? estimatedWorkingBytes / availableBytes : 0
  const heavyThreshold = kind === 'image' ? 75 * 1024 ** 2 : 150 * 1024 ** 2
  const moderateThreshold = kind === 'image' ? 25 * 1024 ** 2 : 60 * 1024 ** 2

  if (bytes >= heavyThreshold || ratio >= 0.2) {
    return { level: 'heavy', label: 'Heavy', detail: 'May approach this browser tab’s memory limit.' }
  }
  if (bytes >= moderateThreshold || ratio >= 0.08) {
    return { level: 'moderate', label: 'Moderate', detail: 'Should work, but keep other large tabs closed.' }
  }
  return { level: 'light', label: 'Comfortable', detail: 'Expected to fit comfortably in browser memory.' }
}

export function calculateSizeChange(originalBytes: number, resultBytes: number): number | null {
  if (!Number.isFinite(originalBytes) || !Number.isFinite(resultBytes) || originalBytes <= 0 || resultBytes < 0) return null
  return ((resultBytes - originalBytes) / originalBytes) * 100
}

export function formatDuration(milliseconds?: number): string {
  if (milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds < 0) return '—'
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`
  return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`
}
