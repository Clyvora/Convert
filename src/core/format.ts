export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

export function getLargeFileWarning(file: File): string | undefined {
  const threshold = file.type.startsWith('audio/') ? 150 * 1024 ** 2 : 75 * 1024 ** 2
  if (file.size < threshold) return undefined
  const memoryHint = 'deviceMemory' in navigator ? ` This device reports about ${String((navigator as Navigator & { deviceMemory?: number }).deviceMemory)} GB of memory.` : ''
  return `This is an unusually large browser conversion and may be slower than desktop software.${memoryHint}`
}
