import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import SettingsPage from './SettingsPage'
import { initialPreferences } from '../core/remotePreferences'
import type { RemoteController } from '../core/useRemoteMedia'

function Harness() {
  const [preferences,setPreferences]=useState(initialPreferences)
  return <SettingsPage controller={{preferences,setPreferences,caps:null,inspection:null} as RemoteController}/>
}
beforeEach(()=>{ localStorage.clear();history.replaceState(null,'','/settings/appearance');vi.restoreAllMocks() })
function settingsFile(text: string) { const file=new File([text],'settings.json',{type:'application/json'}); if (!file.text) Object.defineProperty(file,'text',{value:async()=>text}); return file }
it('navigates real category URLs and preserves section links across history changes',async()=>{
  const user=userEvent.setup();render(<Harness/>)
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
