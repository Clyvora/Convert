import type { Job } from './remoteContracts'
import { formatBytes } from './format'

export function transferProgress(job: Job, now = Date.now()): string | null {
  if (job.state !== 'downloading' || !job.progressUpdatedAt) return null
  if (now - job.progressUpdatedAt > 10000) return 'Source transfer: waiting for progress…'
  const speed = job.transferSpeed
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) return 'Source transfer: calculating speed…'
  const eta = job.transferEtaSeconds
  let remaining = 'Time remaining unavailable'
  if (typeof eta === 'number' && Number.isFinite(eta) && eta >= 0) {
    const seconds = Math.max(1, Math.ceil(eta))
    remaining = seconds < 60 ? `~${seconds}s remaining` : seconds < 3600 ? `~${Math.ceil(seconds / 60)} min remaining` : `~${Math.ceil(seconds / 3600)} hr remaining`
  }
  return `Current source stream: ${formatBytes(speed)}/s · ${remaining}`
}
