import { describe, expect, it } from 'vitest'
import { defaultOptions } from './defaults'
import { canTransition, queueReducer } from './queue'
import type { QueueItem, QueueStatus } from './types'

function item(id: string, status: QueueStatus = 'ready'): QueueItem {
  return {
    id,
    file: new File([new Uint8Array([1])], `${id}.wav`, { type: 'audio/wav' }),
    detected: { format: 'wav', kind: 'audio', mimeType: 'audio/wav', extension: 'wav' },
    options: defaultOptions('wav'), status, progress: 0,
  }
}

describe('queue transitions', () => {
  it('allows loading, conversion, completion, cancellation and retry', () => {
    expect(canTransition('ready', 'loading-engine')).toBe(true)
    expect(canTransition('loading-engine', 'converting')).toBe(true)
    expect(canTransition('converting', 'completed')).toBe(true)
    expect(canTransition('cancelled', 'ready')).toBe(true)
  })
  it('does not overwrite completed state with stale converting state', () => {
    const completed = item('done', 'completed')
    expect(queueReducer([completed], { type: 'update', id: 'done', patch: { status: 'converting' } })[0]).toBe(completed)
  })
  it('cancels queued work without changing active work', () => {
    expect(queueReducer([item('queued'), item('active', 'converting')], { type: 'cancelQueued' }).map(({ status }) => status)).toEqual(['cancelled', 'converting'])
  })
})

