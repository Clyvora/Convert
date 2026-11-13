// Browser metadata is optional: an unsupported codec must not block importing a file.
export async function readVideoMetadata(file: File, signal?: AbortSignal): Promise<{ width?: number; height?: number; duration?: number }> {
  if (signal?.aborted || typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return {}
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), video = document.createElement('video')
    let finished = false
    const finish = (metadata: { width?: number; height?: number; duration?: number } = {}) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      video.onloadedmetadata = null; video.onerror = null
      video.removeAttribute('src'); video.load()
      URL.revokeObjectURL(url)
      resolve(metadata)
    }
    const abort = () => finish()
    const timeout = setTimeout(abort, 3000)
    signal?.addEventListener('abort', abort, { once: true })
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish({
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined,
    })
    video.onerror = abort
    video.src = url
  })
}
