import { describe, expect, it } from 'vitest'

import { canTransition, queueReducer } from './queue'
import type { QueueItem, QueueStatus } from './types'

function item(id: string, status: QueueStatus = 'ready'): QueueItem {
  return {
    id,
    file: new File([new Uint8Array([1])], `${id}.png`, { type: 'image/png' }),
    detected: { format: 'png', kind: 'image', mimeType: 'image/png', extension: 'png' },
    options: {
      outputFormat: 'jpg',
      quality: 0.9,
      lockAspectRatio: true,
      preventUpscale: true,
      jpgBackgroundColor: '#ffffff',
      mp3Bitrate: 192,
    },
    status,
    progress: 0,
  }
}

describe('queue state transitions', () => {
  it('allows the normal image and audio lifecycles', () => {
    expect(canTransition('ready', 'converting')).toBe(true)
    expect(canTransition('ready', 'loading-engine')).toBe(true)
    expect(canTransition('loading-engine', 'converting')).toBe(true)
    expect(canTransition('converting', 'completed')).toBe(true)
  })

  it('blocks stale or impossible transitions', () => {
    expect(canTransition('completed', 'converting')).toBe(false)
    const completed = item('done', 'completed')
    const state = queueReducer([completed], {
      type: 'update',
      id: 'done',
      patch: { status: 'converting', progress: 0.5 },
    })
    expect(state[0]).toBe(completed)
  })

  it('cancels queued work without changing active or completed work', () => {
    const state = [item('queued'), item('active', 'converting'), item('done', 'completed')]
    expect(queueReducer(state, { type: 'cancelQueued' }).map(({ status }) => status)).toEqual([
      'cancelled',
      'converting',
      'completed',
    ])
  })

  it.each(['failed', 'cancelled'] satisfies QueueStatus[])('supports recovery from %s by retrying', (status) => {
    const failed = item('retry', status)
    const recovered = queueReducer([failed], {
      type: 'update',
      id: failed.id,
      patch: { status: 'ready', progress: 0, error: undefined },
    })
    expect(recovered[0]).toMatchObject({ status: 'ready', progress: 0 })
    expect(recovered[0]?.error).toBeUndefined()
  })

  it('clears completed and cancelled entries but retains failures for recovery', () => {
    const state = [item('done', 'completed'), item('cancelled', 'cancelled'), item('failed', 'failed')]
    expect(queueReducer(state, { type: 'clearCompleted' }).map(({ id }) => id)).toEqual(['failed'])
  })
})
