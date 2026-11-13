import { beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import SettingsPage from './SettingsPage'
import { initialPreferences } from '../core/remotePreferences'
import type { RemotePreferences } from '../core/remotePreferences'
import type { Inspection } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import { version } from '../../package.json'

function Harness({ initial = initialPreferences, inspection = null }: { initial?: RemotePreferences; inspection?: Inspection | null }) {
  const [preferences,setPreferences]=useState(() => ({ ...initial, options: { ...initial.options } }))
  return <SettingsPage controller={{preferences,setPreferences,caps:null,inspection} as RemoteController}/>
}
beforeEach(()=>{ localStorage.clear();history.replaceState(null,'','/settings/appearance');vi.restoreAllMocks() })
function settingsFile(text: string) { const file=new File([text],'settings.json',{type:'application/json'}); if (!file.text) Object.defineProperty(file,'text',{value:async()=>text}); return file }
it('navigates real category URLs and preserves section links across history changes',async()=>{
  const user=userEvent.setup();render(<Harness/>)
  expect(screen.getByText(`v${version}`)).toBeVisible()
  await user.click(screen.getByRole('link',{name:'Audio'}))
  expect(location.pathname).toBe('/settings/audio')
  expect(screen.getByRole('group',{name:'Audio format'})).toBeVisible()
  const clipboard=vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue()
  await user.click(screen.getByRole('button',{name:'Copy link to Audio format'}))
  expect(clipboard).toHaveBeenCalledWith(expect.stringContaining('/settings/audio#audio-format'))
  await user.click(screen.getByRole('link',{name:'Accessibility'}))
  await user.click(screen.getByRole('switch',{name:'Reduce motion'}))
  expect(JSON.parse(localStorage.getItem('clyvora-convert-interface-v1')!)).toMatchObject({reduceMotion:true})
})
it('validates imported files and only resets preferences after confirmation',async()=>{
  const user=userEvent.setup();render(<Harness/>)
  await user.click(screen.getByRole('link',{name:'Advanced'}))
  const file=document.querySelector<HTMLInputElement>('input[type=file]')!
  const data={version:1,downloads:{mode:'audio',videoContainer:'mp4',audioContainer:'mp3',options:{preset:'best',audioBitrate:192}},theme:'light',interface:{reduceMotion:true}}
  await user.upload(file,settingsFile(JSON.stringify(data)))
  await screen.findByText(/Settings imported/)
  await user.click(screen.getByRole('link',{name:'Audio'}))
  expect(screen.getByRole('radio',{name:'MP3'})).toBeChecked()
  await user.click(screen.getByRole('link',{name:'Advanced'}))
  await user.click(screen.getByRole('button',{name:'↺ Reset'}))
  await user.click(screen.getByRole('button',{name:'Keep current settings'}))
  await user.click(screen.getByRole('link',{name:'Audio'}))
  expect(screen.getByRole('radio',{name:'MP3'})).toBeChecked()
  await user.click(screen.getByRole('link',{name:'Advanced'}))
  await user.click(screen.getByRole('button',{name:'↺ Reset'}))
  await user.click(screen.getByRole('button',{name:'Reset preferences'}))
  await user.click(screen.getByRole('link',{name:'Audio'}))
  expect(screen.getByRole('radio',{name:'Original'})).toBeChecked()
  await user.click(screen.getByRole('link',{name:'Advanced'}))
  await user.upload(document.querySelector<HTMLInputElement>('input[type=file]')!,settingsFile('{"version":1,"downloads":{"mode":"audio","videoContainer":"mp3"}}'))
  await waitFor(()=>expect(screen.getByText('Invalid output settings.')).toBeVisible())
})

it('opens a category from the overview and preserves choices when returning', async () => {
  history.replaceState(null, '', '/settings')
  const user = userEvent.setup(), view = render(<Harness/>)
  await user.click(screen.getByRole('link', { name: 'Audio settings' }))
  expect(location.pathname).toBe('/settings/audio')
  await user.click(screen.getByRole('radio', { name: 'MP3' }))
  fireEvent.click(view.container.querySelector('.settings-category-header a')!)
  expect(location.pathname).toBe('/settings')
  expect(view.container.querySelector('.mobile-settings-menu')).not.toBeNull()
  act(() => { history.replaceState(null, '', '/settings/audio'); window.dispatchEvent(new PopStateEvent('popstate')) })
  expect(screen.getByRole('radio', { name: 'MP3' })).toBeChecked()
})

it('explains Original audio restrictions and restores encoding choices when changing formats', async () => {
  history.replaceState(null, '', '/settings/audio')
  const user = userEvent.setup()
  render(<Harness/>)
  await user.click(screen.getByText('Advanced audio', { exact: true }))
  const explanation = 'Original keeps the source bitrate, sample rate and channels. Choose another audio format to change these settings.'
  const bitrate = screen.getByRole('group', { name: 'Audio bitrate (kbps)' })
  const sampleRate = screen.getByRole('group', { name: 'Sample rate' })
  const channels = screen.getByRole('group', { name: 'Channels' })
  for (const group of [bitrate, sampleRate, channels]) {
    expect(group).toBeDisabled()
    expect(group).toHaveAccessibleDescription(explanation)
  }
  expect(screen.getByText(explanation)).toBeVisible()
  await user.click(screen.getByRole('radio', { name: 'MP3' }))
  expect(screen.queryByText(explanation)).not.toBeInTheDocument()
  for (const group of [bitrate, sampleRate, channels]) {
    expect(group).toBeEnabled()
    expect(group).not.toHaveAccessibleDescription(explanation)
  }
  await user.click(within(bitrate).getByRole('radio', { name: '192' }))
  await user.click(within(sampleRate).getByRole('radio', { name: '44.1 kHz' }))
  await user.click(within(channels).getByRole('radio', { name: 'Stereo' }))
  await user.click(screen.getByRole('radio', { name: 'Original' }))
  expect(screen.getByText(explanation)).toBeVisible()
  expect(within(bitrate).getByRole('radio', { name: 'Automatic' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'MP3' }))
  expect(within(bitrate).getByRole('radio', { name: '192' })).toBeChecked()
  expect(within(sampleRate).getByRole('radio', { name: '44.1 kHz' })).toBeChecked()
  expect(within(channels).getByRole('radio', { name: 'Stereo' })).toBeChecked()
})

it('starts with download defaults and saves behavior changes without touching output choices', async () => {
  history.replaceState(null, '', '/settings')
  const user = userEvent.setup()
  render(<Harness initial={{ ...initialPreferences, audioContainer: 'mp3', options: { preset: 'best', audioBitrate: 192 } }}/>)
  expect(screen.getByRole('heading', { name: 'Download defaults' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Audio settings' })).toHaveTextContent('MP3 · 192 kbps')
  await user.click(screen.getByRole('switch', { name: 'Download ready files automatically' }))
  expect(JSON.parse(localStorage.getItem('clyvora-convert-interface-v1')!)).toMatchObject({ autoDownload: false })
  await user.click(screen.getByRole('link', { name: 'Audio settings' }))
  expect(screen.getByRole('radio', { name: 'MP3' })).toBeChecked()
  expect(screen.getByRole('radio', { name: '192' })).toBeChecked()
})

it.each(['wav', 'flac'] as const)('explains unused bitrate for %s while preserving encoding choices', async container => {
  history.replaceState(null, '', '/settings/audio')
  const user = userEvent.setup()
  render(<Harness initial={{ ...initialPreferences, audioContainer: container, options: { preset: 'best', audioBitrate: 192, sampleRate: 44100, channels: 2 } }}/>)
  expect(screen.getByRole('group', { name: 'Audio bitrate (kbps)' })).toBeDisabled()
  expect(screen.getByText(new RegExp(`${container.toUpperCase()} does not use a target bitrate`))).toBeVisible()
  await user.click(screen.getByText('Advanced audio', { exact: true }))
  expect(screen.getByRole('group', { name: 'Sample rate' })).toBeEnabled()
  expect(screen.getByRole('radio', { name: '44.1 kHz' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'MP3' }))
  expect(screen.getByRole('radio', { name: '192' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Stereo' })).toBeChecked()
})

it('explains and repairs an incompatible saved Opus rate without changing bitrate or channels', async () => {
  history.replaceState(null, '', '/settings/audio')
  const user = userEvent.setup()
  render(<Harness initial={{ ...initialPreferences, audioContainer: 'mp3', options: { preset: 'best', audioBitrate: 192, sampleRate: 44100, channels: 2 } }}/>)
  await user.click(screen.getByRole('radio', { name: 'OPUS' }))
  expect(screen.getByText('Your saved sample rate is not supported by Opus.')).toBeVisible()
  await user.click(screen.getByText('Advanced audio', { exact: true }))
  expect(screen.getByRole('radio', { name: '44.1 kHz (unavailable)' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Use 48 kHz' }))
  expect(screen.queryByRole('button', { name: 'Use 48 kHz' })).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '48 kHz' })).toBeChecked()
  expect(screen.getByRole('radio', { name: '192' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Stereo' })).toBeChecked()
})

it('opens advanced controls for a copied section link and follows same-page hash changes', async () => {
  history.replaceState(null, '', '/settings/audio#sample-rate')
  render(<Harness initial={{ ...initialPreferences, audioContainer: 'mp3' }}/>)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Sample rate' })).toHaveFocus())
  expect(screen.getByRole('group', { name: 'Sample rate' })).toBeVisible()
  act(() => { history.pushState(null, '', '#channels'); window.dispatchEvent(new HashChangeEvent('hashchange')) })
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Channels' })).toHaveFocus())
})

it('keeps source availability and shared quality explanations visible without optional descriptions', async () => {
  history.replaceState(null, '', '/settings/video')
  const source: Inspection = { id: 'example', title: 'Example', kind: 'media', provider: 'fixture', mediaId: '1', url: 'https://example.com/video', creator: null, duration: 10, published: null, thumbnail: null, count: null, countConfidence: 'unknown', formats: [{ id: 'video', ext: 'mp4', video: 'h264', audio: 'aac', width: 1280, height: 720, fps: 30, bitrate: 100, sampleRate: 48000, channels: 2, language: 'en', size: null, sizeKind: 'unknown' }], subtitles: [], restrictions: [], expires: Date.now() + 60000 }
  const user = userEvent.setup()
  render(<Harness initial={{ ...initialPreferences, options: { preset: 'best', height: 1080 } }} inspection={source}/>)
  expect(screen.getByText('Shared with audio downloads. Smaller file may require conversion.')).toBeVisible()
  expect(screen.getByText('Your saved resolution is unavailable for this link. Choose Source or an available resolution.')).toBeVisible()
  expect(screen.getByRole('radio', { name: '1080p (unavailable)' })).toBeChecked()
  await user.click(within(screen.getByRole('group', { name: 'Resolution' })).getByRole('radio', { name: 'Source' }))
  expect(screen.queryByText('Your saved resolution is unavailable for this link. Choose Source or an available resolution.')).not.toBeInTheDocument()
})
