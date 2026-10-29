import { compatibility, parseOutput } from './remoteContracts'
import type { Container, Inspection, Mode, Output } from './remoteContracts'

export type DownloadMode = 'auto' | 'audio' | 'video'
export interface RemotePreferences {
  mode: DownloadMode
  videoContainer: Container
  audioContainer: Container
  options: Omit<Output, 'mode' | 'container'>
}
export const REMOTE_PREFERENCE_KEY = 'clyvora-convert-remote-preferences-v2'
export const initialPreferences: RemotePreferences = {
  mode: 'auto', videoContainer: 'original', audioContainer: 'original', options: { preset: 'best' },
}

export function loadRemotePreferences(): RemotePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(REMOTE_PREFERENCE_KEY) || 'null')
    if (saved && ['auto', 'audio', 'video'].includes(saved.mode)) {
      parseOutput({ ...saved.options, mode: 'combined', container: saved.videoContainer })
      parseOutput({ ...saved.options, videoCodec: undefined, mode: 'audio', container: saved.audioContainer })
      return saved
    }
    const old = JSON.parse(localStorage.getItem('clyvora-convert-remote-preferences-v1') || 'null')
    if (old && ['combined', 'audio', 'video'].includes(old.mode) && (old.container === 'original' || old.container in compatibility)) {
      const audio = old.container !== 'original' && compatibility[old.container as Exclude<Container, 'original'>].kind === 'audio'
      return { mode: old.mode === 'combined' ? 'auto' : old.mode, videoContainer: audio ? 'original' : old.container, audioContainer: audio ? old.container : 'original', options: { preset: old.preset === 'smaller' ? 'smaller' : 'best' } }
    }
  } catch { /* Preferences are optional; invalid or unavailable storage uses defaults. */ }
  return { ...initialPreferences, options: { ...initialPreferences.options } }
}

export function outputFor(preferences: RemotePreferences, inspection?: Inspection, collectionMode?: Mode): Output {
  let mode: Mode = collectionMode || (preferences.mode === 'auto' ? 'combined' : preferences.mode)
  if (!collectionMode && preferences.mode === 'auto' && inspection) {
    const video = inspection.formats.some(f => f.video)
    const audio = inspection.formats.some(f => f.audio)
    mode = video ? audio ? 'combined' : 'video' : 'audio'
  }
  const output = parseOutput({ ...preferences.options, mode, container: mode === 'audio' ? preferences.audioContainer : preferences.videoContainer })
  if (mode === 'audio') { delete output.height; delete output.fps; delete output.videoCodec; delete output.subtitle; delete output.subtitleFormat }
  if (mode === 'video') { delete output.audioBitrate; delete output.sampleRate; delete output.channels; delete output.language; delete output.cover }
  if (['wav', 'flac'].includes(output.container)) delete output.audioBitrate
  if (!inspection || collectionMode) return output
  if (inspection.restrictions.length) throw new Error(`This source has limitations: ${inspection.restrictions.join(', ')}.`)
  if (mode !== 'audio' && !inspection.formats.some(f => f.video && (!output.height || f.height === output.height) && (!output.fps || f.fps === output.fps))) throw new Error('That video quality is unavailable. Choose an available resolution or frame rate in settings.')
  if (mode !== 'video' && !inspection.formats.some(f => f.audio && (!output.language || f.language === output.language))) throw new Error('That audio track is unavailable. Choose another language or media mode.')
  if (output.subtitle && !inspection.subtitles.includes(output.subtitle)) throw new Error('Those subtitles are unavailable. Choose an available language in settings.')
  return output
}
