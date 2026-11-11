export function youtubePlaylistURL(input: string): string | null {
  if (/\s/.test(input.trim())) return null
  try {
    const url = new URL(input.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null
    const hosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']
    if (!hosts.includes(url.hostname)) return null
    const watchLink = url.hostname === 'youtu.be' ? /^\/[\w-]{11}\/?$/.test(url.pathname) : url.pathname === '/watch' && /^[\w-]{11}$/.test(url.searchParams.get('v') || '')
    const playlist = url.searchParams.get('list')
    return watchLink && playlist && /^[\w-]{10,100}$/.test(playlist) ? `https://www.youtube.com/playlist?list=${playlist}` : null
  } catch { return null }
}
