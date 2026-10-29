import { beforeEach, expect, it } from 'vitest'
import { loadRemotePreferences, outputFor } from './remotePreferences'
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
