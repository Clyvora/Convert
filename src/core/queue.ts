import type { QueueItem, QueueStatus } from './types'

export type QueueAction =
  | { type: 'add'; items: QueueItem[] }
  | { type: 'remove'; id: string }
  | { type: 'update'; id: string; patch: Partial<QueueItem> }
  | { type: 'cancelQueued' }
  | { type: 'clearCompleted' }
  | { type: 'reset' }

const TRANSITIONS: Record<QueueStatus, readonly QueueStatus[]> = {
  ready: ['loading-engine', 'converting', 'cancelled'],
  'loading-engine': ['converting', 'failed', 'cancelled'],
  converting: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['ready'],
  cancelled: ['ready'],
}

export function canTransition(from: QueueStatus, to: QueueStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to)
}

export function queueReducer(state: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case 'add':
      return [...state, ...action.items]
    case 'remove':
      return state.filter((item) => item.id !== action.id)
    case 'update':
      return state.map((item) => {
        if (item.id !== action.id) return item
        if (action.patch.status && !canTransition(item.status, action.patch.status)) return item
        return { ...item, ...action.patch }
      })
    case 'cancelQueued':
      return state.map((item) => item.status === 'ready' ? { ...item, status: 'cancelled' } : item)
    case 'clearCompleted':
      return state.filter((item) => item.status !== 'completed' && item.status !== 'cancelled')
    case 'reset':
      return []
  }
}
