import { beforeEach, expect, it } from 'vitest'
import { collectionModeFor, initialPreferences, loadRemotePreferences, outputFor } from './remotePreferences'
beforeEach(() => localStorage.clear())
it('migrates existing output preferences without losing the selected format', () => {
  localStorage.setItem('clyvora-convert-remote-preferences-v1',JSON.stringify({mode:'combined',container:'webm',preset:'smaller'}))
  const preferences = loadRemotePreferences()
  expect(preferences).toMatchObject({mode:'auto',videoContainer:'webm',audioContainer:'original',options:{preset:'smaller'}})
  expect(outputFor(preferences,undefined,'combined').container).toBe('webm')
})
it('keeps separate audio and video formats and rejects corrupted saved settings', () => {
  localStorage.setItem('clyvora-convert-remote-preferences-v2',JSON.stringify({mode:'auto',videoContainer:'mp3',audioContainer:'mp4',options:{preset:'best'}}))
  expect(loadRemotePreferences().videoContainer).toBe('original')
})

it('preserves original audio without applying another format’s saved encoding preferences', () => {
  const preferences = { mode: 'audio' as const, videoContainer: 'original' as const, audioContainer: 'original' as const, options: { preset: 'best' as const, audioBitrate: 320, sampleRate: 48000, channels: 2 } }
  const original = outputFor(preferences)
  expect(original).not.toHaveProperty('audioBitrate'); expect(original).not.toHaveProperty('sampleRate'); expect(original).not.toHaveProperty('channels')
  expect(outputFor({ ...preferences, audioContainer: 'mp3' })).toMatchObject({audioBitrate:320,sampleRate:48000,channels:2})
  expect(outputFor({ ...preferences, mode: 'auto', videoContainer: 'mp4' })).not.toHaveProperty('audioBitrate')
})

it.each(['SoundcloudSet', 'soundcloud:playlist', 'BandcampAlbum'])('defaults %s collections to audio and preserves the saved audio format', provider => {
  const preferences = { ...initialPreferences, audioContainer: 'mp3' as const }
  const mode = collectionModeFor(preferences, { provider, formats: [] })
  expect(mode).toBe('audio')
  expect(outputFor(preferences, undefined, mode)).toMatchObject({ mode: 'audio', container: 'mp3' })
  expect(collectionModeFor({ ...preferences, mode: 'video' }, { provider, formats: [] })).toBe('video')
})

it('keeps uninspected video collections combined and respects an explicit Audio selection', () => {
  const inspection = { provider: 'YoutubeTab', formats: [] }
  expect(collectionModeFor(initialPreferences, inspection)).toBe('combined')
  expect(collectionModeFor({ ...initialPreferences, mode: 'audio' }, inspection)).toBe('audio')
})
