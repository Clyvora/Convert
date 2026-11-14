export function canPreview(blob?: Blob): boolean {
  if (!blob || typeof document === 'undefined') return false
  const kind = blob.type.startsWith('video/') ? 'video' : blob.type.startsWith('audio/') ? 'audio' : null
  return Boolean(kind && document.createElement(kind).canPlayType(blob.type))
}
