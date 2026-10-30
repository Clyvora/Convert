import { expect, it } from 'vitest'
import { transferProgress } from './transferProgress'
import type { Job } from './remoteContracts'
const now = 100000
const job = { state: 'downloading', progressUpdatedAt: now, transferSpeed: 1048576, transferEtaSeconds: 90 } as Job
it('shows measured speed and an approximate current-stream ETA', () => {
  expect(transferProgress(job, now)).toBe('Current source stream: 1.0 MB/s · ~2 min remaining')
})
it('handles unknown totals and invalid measurements without inventing an estimate', () => {
  expect(transferProgress({ ...job, transferEtaSeconds: null }, now)).toContain('Time remaining unavailable')
  expect(transferProgress({ ...job, transferEtaSeconds: Infinity }, now)).toContain('Time remaining unavailable')
  expect(transferProgress({ ...job, transferSpeed: 0 }, now)).toContain('calculating speed')
  expect(transferProgress({ ...job, transferSpeed: NaN }, now)).toContain('calculating speed')
})
it('hides stale values and does not carry transfer metrics into other phases', () => {
  expect(transferProgress(job, now + 11000)).toContain('waiting for progress')
  for (const state of ['processing','ready','queued','failed','cancelled'] as const) expect(transferProgress({ ...job, state }, now)).toBeNull()
  expect(transferProgress({ state: 'downloading' } as Job, now)).toBeNull()
})
