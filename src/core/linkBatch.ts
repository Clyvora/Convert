export const MAX_BATCH_LINKS = 20
export function splitLinks(input: string): string[] {
  return [...new Set(input.trim().split(/\s+/).filter(Boolean))]
}
export interface LinkResult {
  url: string
  state: 'waiting' | 'checking' | 'queued' | 'failed' | 'cancelled'
  message?: string
}

export async function batchRequest<T>(work: () => Promise<T>, signal: AbortSignal, onWait: () => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    try { return await work() } catch (failure) {
      const error = failure as { code?: string; retryAfter?: number }
      if (error?.code !== 'RATE_LIMITED' || attempt >= 2) throw failure
      onWait()
      const seconds = Number.isFinite(error.retryAfter) ? Math.max(1, Math.min(300, error.retryAfter!)) : 60
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason) }
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, seconds * 1000)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })
    }
  }
}
