import { version } from '../../package.json'

export interface ErrorReportInput {
  area: 'download' | 'local'
  code?: string
  state?: string
  options?: unknown
  engine?: string
}
const enums: Record<string, readonly unknown[]> = {
  mode: ['combined', 'audio', 'video'], container: ['original', 'mp4', 'webm', 'mkv', 'mp3', 'm4a', 'opus', 'ogg', 'wav', 'flac'],
  downloadMode: ['auto','audio','video'], videoContainer: ['original','mp4','webm','mkv'], audioContainer: ['original','mp3','m4a','opus','ogg','wav','flac'],
  outputFormat: ['mp4', 'webm', 'mkv', 'mp3', 'm4a', 'opus', 'ogg', 'wav', 'flac'], preset: ['best', 'smaller'],
  audioChannels: ['source', 1, 2], audioSampleRate: ['source', 44100, 48000], videoResolution: ['original', 1080, 720, 480],
  videoQuality: ['smaller', 'balanced', 'high'], videoCodec: ['auto', 'source', 'h264', 'vp8', 'vp9', 'av1'], subtitleFormat: ['embedded', 'srt', 'vtt'],
}
const numeric = new Set(['height', 'fps', 'audioBitrate', 'sampleRate', 'channels'])
const boolean = new Set(['metadata', 'chapters', 'cover'])
export function errorReport(input: ErrorReportInput, userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const browserName = userAgent.includes('Edg/') ? 'Edge' : userAgent.includes('Firefox/') ? 'Firefox' : userAgent.includes('Chrome/') ? 'Chrome' : userAgent.includes('Safari/') ? 'Safari' : 'Other'
  const browser = (browserName === 'Edge' ? /Edg\/([\d.]+)/ : browserName === 'Firefox' ? /Firefox\/([\d.]+)/ : browserName === 'Chrome' ? /Chrome\/([\d.]+)/ : /Version\/([\d.]+)/).exec(userAgent)
  const platform = /iPhone|iPad/.test(userAgent) ? 'iOS' : /Android/.test(userAgent) ? 'Android' : /Windows/.test(userAgent) ? 'Windows' : /Macintosh/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : 'Other'
  const options: Record<string, unknown> = {}
  if (input.options && typeof input.options === 'object') for (const [key, value] of Object.entries(input.options)) {
    if (enums[key]?.includes(value) || numeric.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 192000 || boolean.has(key) && typeof value === 'boolean') options[key] = value
  }
  return JSON.stringify({
    app: 'mewvi', version, area: input.area,
    code: input.code && /^[A-Z][A-Z0-9_]{0,59}$/.test(input.code) ? input.code : 'UNKNOWN_ERROR',
    state: input.state && ['created','queued','downloading','processing','packaging','ready','partial','failed','cancelled','interrupted','expired','loading-engine','converting','completed'].includes(input.state) ? input.state : undefined,
    browser: `${browserName}${browser ? ` ${browser[1].split('.')[0]}` : ''}`, platform,
    engine: input.engine && /^[\d.]{1,30}$/.test(input.engine) ? input.engine : undefined,
    options,
  }, null, 2)
}
