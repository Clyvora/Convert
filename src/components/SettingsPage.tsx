import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { compatibility, containers } from '../core/remoteContracts'
import type { Container, Output } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import { PageDirectory, SectionHeading } from './PagePrimitives'
import { useSectionNavigation } from '../core/navigation'
import { interfaceDefaults, saveInterfacePreferences, useInterfacePreferences } from '../core/interfacePreferences'
import { initialPreferences } from '../core/remotePreferences'
import { parseOutput } from '../core/remoteContracts'
import Panel from './Panel'
import Mascot from './Mascot'
import { version } from '../../package.json'
import { Icon } from './Icon'
import './SettingsPage.css'

const sections = [
  { id: 'appearance', label: 'Appearance', icon: 'appearance', group: 0 },
  { id: 'accessibility', label: 'Accessibility', icon: 'accessibility', group: 0 },
  { id: 'video', label: 'Video', icon: 'video', group: 1 },
  { id: 'audio', label: 'Audio', icon: 'audio', group: 1 },
  { id: 'metadata', label: 'Metadata', icon: 'metadata', group: 1 },
  { id: 'local', label: 'Local processing', icon: 'local', group: 2 },
  { id: 'instances', label: 'Processing service', icon: 'instances', group: 2 },
  { id: 'privacy', label: 'Privacy', icon: 'privacy', group: 3 },
  { id: 'advanced', label: 'Advanced', icon: 'advanced', group: 3 },
  { id: 'debug', label: 'App information', icon: 'about', group: 3 },
] as const
const sectionIds = sections.map(s => s.id)
const routes = ['index', ...sectionIds] as const
const menuIcons = { appearance: 'appearance', accessibility: 'accessibility', video: 'video', audio: 'audio', metadata: 'metadata', local: 'local', instances: 'instances', privacy: 'privacy', advanced: 'advanced', debug: 'about' } as const
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
const sectionDescriptions: Record<string, string> = {
  appearance: 'Theme and setting descriptions', accessibility: 'Motion, transparency and download behavior',
  local: 'On-device conversion', instances: 'Connection and service limits', privacy: 'How files and links are handled',
  advanced: 'Import, export and reset preferences', debug: 'Version and diagnostics',
}

function Choices({ label, value, values, onChange, hint, essential = false, disabled = false, disabledValues = [], describedBy }: { label: string; value: string; values: [string, string][]; onChange: (value: string) => void; hint?: string; essential?: boolean; disabled?: boolean; disabledValues?: string[]; describedBy?: string }) {
  const name = useId()
  const hintId = `${name}-hint`
  const columns = { '--setting-columns': Math.min(values.length, 4), '--setting-columns-narrow': Math.min(values.length, 3) } as CSSProperties
  return <div className="setting-block"><SectionHeading id={slug(label)}>{label}</SectionHeading><fieldset className="setting-choices" disabled={disabled} aria-describedby={describedBy || (hint ? hintId : undefined)}><legend className="sr-only">{label}</legend><div className="setting-segments" style={columns}>{values.map(([id, text]) => <label key={id} className={id === value ? 'is-selected' : ''}><input type="radio" name={name} value={id} checked={value === id} disabled={disabledValues.includes(id)} onChange={() => onChange(id)}/><span>{text}</span></label>)}</div></fieldset>{hint && <p id={hintId} className={`setting-hint${essential ? ' setting-hint-essential' : ''}`}>{hint}</p>}</div>
}
function Toggle({ label, checked, onChange, hint, essential = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint: string; essential?: boolean }) {
  const hintId = useId()
  return <div className="setting-block"><label className="setting-toggle"><span>{label}</span><input type="checkbox" role="switch" aria-describedby={hintId} checked={checked} onChange={e => onChange(e.target.checked)}/><span className="toggle-track" aria-hidden="true"/></label><p id={hintId} className={`setting-hint${essential ? ' setting-hint-essential' : ''}`}>{hint}</p></div>
}
function Select({ label, children, value, onChange, hint }: { label: string; children: ReactNode; value: string | number; onChange: (value: string) => void; hint?: string }) {
  const hintId = useId()
  return <div className="setting-block" id={slug(label)}><label className="setting-select"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)} aria-describedby={hint ? hintId : undefined}>{children}</select></label>{hint && <p id={hintId} className="setting-hint">{hint}</p>}</div>
}

function AdvancedSettings({ label, children }: { label: string; children: ReactNode }) {
  return <details className="setting-advanced"><summary>{label}</summary><div>{children}</div></details>
}

export default function SettingsPage({ controller: r }: { controller: RemoteController }) {
  const selected = useSectionNavigation('/settings', routes, 'index', { output: 'video', extras: 'metadata' })
  const section = selected === 'index' ? 'appearance' : selected
  const mobileHeading = useRef<HTMLHeadingElement>(null)
  const studio = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!window.matchMedia?.('(max-width: 900px)').matches) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    mobileHeading.current?.focus({ preventScroll: true })
  }, [selected])
  useEffect(() => {
    let frame = 0
    const reveal = () => {
      let id = ''
      try { id = decodeURIComponent(location.hash.slice(1)) } catch { return }
      if (!/^[a-z0-9-]+$/.test(id)) return
      const target = studio.current?.querySelector<HTMLElement>(`#${id}`)
      if (!target) return
      let disclosure = target.closest('details')
      while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest('details') || null }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!target.isConnected) return
        target.scrollIntoView?.({ block: 'start', behavior: 'instant' })
        const heading = target.querySelector<HTMLElement>('h3') || target
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      })
    }
    reveal()
    window.addEventListener('hashchange', reveal)
    window.addEventListener('popstate', reveal)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', reveal); window.removeEventListener('popstate', reveal) }
  }, [selected])
  const visit = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    if (location.pathname !== path) history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  const [ui, setUI] = useInterfacePreferences()
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('clyvora-theme') || 'dark' } catch { return 'dark' } })
  const [notice, setNotice] = useState(''), [confirm, setConfirm] = useState<'reset' | 'cache' | null>(null)
  const importFile = useRef<HTMLInputElement>(null)
  const p = r.preferences, o = p.options, i = r.inspection
  const originalAudio = p.audioContainer === 'original'
  const losslessAudio = ['wav', 'flac'].includes(p.audioContainer)
  const originalAudioHintId = useId()
  const losslessAudioHintId = useId()
  const audioDescription = originalAudio ? originalAudioHintId : undefined
  const bitrateDescription = audioDescription || (losslessAudio ? losslessAudioHintId : undefined)
  const opusRateMismatch = p.audioContainer === 'opus' && o.sampleRate !== undefined && ![8000, 12000, 16000, 24000, 48000].includes(o.sampleRate)
  const update = (patch: Partial<Output>) => r.setPreferences(previous => ({ ...previous, options: { ...previous.options, ...patch } }))
  const formats = (kind: 'audio' | 'video'): [string, string][] => (r.caps?.containers || containers).filter(f => f === 'original' || compatibility[f].kind === kind).map(f => [f, f === 'original' ? 'Original' : f.toUpperCase()])
  const source = i?.kind === 'media' ? i : null
  const heights = [...new Set(source?.formats.filter(f => f.video).map(f => f.height).filter((h): h is number => h !== null) || [])].sort((a,b) => b-a)
  const fps = [...new Set(source?.formats.filter(f => f.video && (!o.height || f.height === o.height)).map(f => f.fps).filter((f): f is number => f !== null) || [])].sort((a,b) => b-a)
  const languages = [...new Set(source?.formats.map(f => f.language).filter((l): l is string => !!l) || [])]
  const sampleRates: [string, string][] = [['', 'Source'], ...[...new Set([...(p.audioContainer === 'opus' ? [] : [44100]), ...(o.sampleRate ? [o.sampleRate] : []), 48000])].map(rate => [String(rate), `${rate / 1000} kHz${p.audioContainer === 'opus' && ![8000, 12000, 16000, 24000, 48000].includes(rate) ? ' (unavailable)' : ''}`] as [string, string])]
  const chooseTheme = (value: string) => {
    setTheme(value)
    try { localStorage.setItem('clyvora-theme', value) } catch { /* Optional device preference. */ }
    window.dispatchEvent(new Event('convert-interface-change'))
  }
  async function importSettings(file?: File) {
    if (!file) return
    try {
      if (file.size > 65536) throw new Error('Settings files must be smaller than 64 KB.')
      const data = JSON.parse(await file.text()), value = data.downloads
      if (data.version !== 1 || !value || !['auto','audio','video'].includes(value.mode)) throw new Error('Choose a mewvi settings export.')
      const video = parseOutput({ ...value.options, mode: 'combined', container: value.videoContainer })
      const audio = parseOutput({ ...value.options, height: undefined, fps: undefined, videoCodec: undefined, mode: 'audio', container: value.audioContainer })
      const { mode: _mode, container: _container, ...options } = video
      r.setPreferences({ mode: value.mode, videoContainer: video.container, audioContainer: audio.container, options })
      const appearance = Object.fromEntries(Object.entries(interfaceDefaults).map(([key, fallback]) => [key, typeof data.interface?.[key] === 'boolean' ? data.interface[key] : fallback])) as typeof interfaceDefaults
      saveInterfacePreferences(appearance)
      if (['auto','light','dark'].includes(data.theme)) chooseTheme(data.theme)
      setNotice('Settings imported. Existing jobs keep their settings.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to import settings.') }
  }
  function exportSettings() {
    const data = new Blob([JSON.stringify({ version: 1, downloads: p, interface: ui, theme }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(data), link = document.createElement('a')
    link.href = url; link.download = 'mewvi-settings.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function confirmed() {
    try {
      if (confirm === 'reset') { r.setPreferences({ ...initialPreferences, options: { ...initialPreferences.options } }); saveInterfacePreferences({ ...interfaceDefaults }); chooseTheme('dark'); setNotice('Preferences reset. Your jobs and files are unchanged.') }
      else { if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.filter(key => key.startsWith('clyvora-convert-')).map(key => caches.delete(key))) }; setNotice('Application cache cleared. Assets download again when needed.') }
    } catch { setNotice('This browser could not update local storage.') }
    setConfirm(null)
  }
  return <div ref={studio} className={`settings-studio directory-layout ${selected === 'index' ? 'settings-index' : 'settings-category'} ${ui.showHelp ? 'show-explanations' : ''}`}>
    <PageDirectory title="Settings" version={`v${version}`} base="/settings" entries={sections} selected={selected} companion={<Mascot className="directory-companion" pose={section === 'privacy' ? 'sleeping' : section === 'local' ? 'local' : section === 'instances' ? 'working' : section === 'audio' || section === 'video' ? 'pounce' : 'curious'}/>}/>
    {selected === 'index' && <div className="settings-home">
      <h2 ref={mobileHeading} tabIndex={-1}>Download defaults</h2>
      <p className="settings-scope">Saved automatically in this browser for new public-link downloads. Local files have their own options.</p>
      <nav className="settings-primary" aria-label="Download settings">{[
        { id: 'video', label: 'Video', value: `${p.videoContainer === 'original' ? 'Original' : p.videoContainer.toUpperCase()} · ${o.preset === 'best' ? 'Best available' : 'Smaller file'}` },
        { id: 'audio', label: 'Audio', value: `${p.audioContainer === 'original' ? 'Original' : p.audioContainer.toUpperCase()} · ${originalAudio ? 'Source audio' : losslessAudio ? 'Lossless' : !o.audioBitrate ? 'Automatic bitrate' : `${o.audioBitrate} kbps`}` },
        { id: 'metadata', label: 'Metadata', value: [o.metadata && 'File details', o.chapters && 'Chapters', o.cover && 'Cover art', o.subtitle && 'Subtitles'].filter(Boolean).join(' · ') || 'Optional extras off' },
      ].map(item => <a key={item.id} href={`/settings/${item.id}`} aria-label={`${item.label} settings`} onClick={event => visit(event, `/settings/${item.id}`)}><span className={`settings-menu-icon settings-menu-icon-${item.id}`}><Icon name={menuIcons[item.id as keyof typeof menuIcons]}/></span><span><strong>{item.label}</strong><small>{item.value}</small></span><span className="settings-menu-chevron" aria-hidden="true">›</span></a>)}</nav>
      <SectionHeading id="behavior">Download behavior</SectionHeading>
      <Toggle label="Download ready files automatically" checked={ui.autoDownload} onChange={autoDownload => setUI({ autoDownload })} essential hint="For new downloads. Previously restored jobs stay manual."/>
      <Toggle label="Open queue when work starts" checked={ui.autoOpenQueue} onChange={autoOpenQueue => setUI({ autoOpenQueue })} essential hint="Turn off to keep the link field visible. Progress stays available in Downloads."/>
      <div className="mobile-settings-menu"><h3>More settings</h3>
        <nav aria-label="Settings menu">{[0, 2, 3].map(group => <div className="settings-menu-group" key={group}>{sections.filter(item => item.group === group).map(item => <a key={item.id} href={`/settings/${item.id}`} onClick={event => visit(event, `/settings/${item.id}`)}>
          <span className={`settings-menu-icon settings-menu-icon-${item.id}`}><Icon name={menuIcons[item.id]}/></span><span className="settings-menu-text">{item.label}<small>{sectionDescriptions[item.id]}</small></span><span className="settings-menu-chevron" aria-hidden="true">›</span>
        </a>)}</div>)}</nav>
        <p className="settings-menu-version">v{version}</p>
      </div>
    </div>}
    {selected !== 'index' && <section key={section} className="settings-detail" data-category={section} aria-label={`${sections.find(s => s.id === section)!.label} settings`}>
      <header className="settings-category-header"><a href="/settings" onClick={event => visit(event, '/settings')} aria-label="All settings"><Icon name="arrow"/></a><h2 ref={mobileHeading} tabIndex={-1}>{sections.find(s => s.id === section)!.label}</h2></header>
      {['video', 'audio', 'metadata'].includes(section) && <p className="settings-scope">{section === 'video' ? 'For video in Auto and Video only modes.' : section === 'audio' ? 'Choose the format for Audio mode and audio-only links in Auto. Quality and track choices can also affect video downloads.' : 'Extras depend on the source and output format.'} Saved automatically for new public-link downloads.</p>}
      {section === 'appearance' && <>
        <Choices label="Theme" value={theme} onChange={chooseTheme} values={[[ 'auto', 'Auto' ], [ 'light', 'Light' ], [ 'dark', 'Dark' ]]} hint="Auto follows your device’s light or dark appearance."/>
        <SectionHeading id="explanations">Explanations</SectionHeading><Toggle label="Show setting descriptions" checked={ui.showHelp} onChange={showHelp => setUI({ showHelp })} hint="Extra detail beneath controls. Your choices are saved automatically."/>
      </>}
      {section === 'accessibility' && <>
        <SectionHeading id="visual">Visual</SectionHeading>
        <Toggle label="Reduce motion" checked={ui.reduceMotion} onChange={reduceMotion => setUI({ reduceMotion })} hint="Disable animation and transitions. Your device’s reduced-motion preference is always respected."/>
        <Toggle label="Reduce transparency" checked={ui.reduceTransparency} onChange={reduceTransparency => setUI({ reduceTransparency })} hint="Use solid surfaces and remove background blur."/>
        <SectionHeading id="behavior">Behavior</SectionHeading>
        <Toggle label="Open queue when work starts" checked={ui.autoOpenQueue} onChange={autoOpenQueue => setUI({ autoOpenQueue })} hint="Turn off to keep the link input visible while processing. Progress remains on the queue button."/>
        <Toggle label="Download ready files automatically" checked={ui.autoDownload} onChange={autoDownload => setUI({ autoDownload })} hint="Applies to newly submitted work. Restored jobs never download automatically."/>
      </>}
      {section === 'video' && <>
        <Choices label="Video format" value={p.videoContainer} values={formats('video')} onChange={value => r.setPreferences(previous => ({ ...previous, videoContainer: value as Container }))} hint="Original keeps a suitable source container. MP4 offers broad playback compatibility; WebM favors modern codecs."/>
        <Choices label="Quality" value={o.preset} values={[[ 'best', 'Best available' ], [ 'smaller', 'Smaller file' ]]} onChange={value => update({ preset: value as Output['preset'] })} essential hint="Shared with audio downloads. Smaller file may require conversion."/>
        <Choices label="Resolution" value={String(o.height || '')} values={[[ '', 'Source' ], ...[...new Set([...(o.height ? [o.height] : []), ...heights])].map(h => [String(h), `${h}p${source && !heights.includes(h) ? ' (unavailable)' : ''}`] as [string,string])]} onChange={value => update({ height: Number(value) || undefined, fps: undefined })} essential hint={source ? o.height && !heights.includes(o.height) ? 'Your saved resolution is unavailable for this link. Choose Source or an available resolution.' : 'Available resolutions for the checked link. Source keeps the available size.' : i ? 'Collection quality is checked per item.' : 'Check a link on the Download page to see its resolutions. Source keeps the available size.'}/>
        <AdvancedSettings label="Advanced video">
        <Choices label="Video codec" value={o.videoCodec || ''} values={[[ '', 'Auto' ], [ 'source', 'Source' ], [ 'h264', 'H.264' ], [ 'vp9', 'VP9' ], [ 'av1', 'AV1' ]]} onChange={value => update({ videoCodec: value as Output['videoCodec'] || undefined })} hint="Auto chooses a compatible codec. Preserving the source can avoid a costly conversion."/>
        <Select label="Frame rate" value={o.fps || ''} onChange={value => update({ fps: Number(value) || undefined })} hint="Frame rates appear after checking a video link."><option value="">Source</option>{[...new Set([...(o.fps ? [o.fps] : []), ...fps])].map(f => <option key={f} value={f}>{f} fps{source && !fps.includes(f) ? ' (unavailable)' : ''}</option>)}</Select>
        {i && <details className="setting-source"><summary>Available source media</summary><div className="source-formats">{i.formats.map(f => <p key={f.id}>{f.height ? `${f.height}p · ` : ''}{f.fps ? `${f.fps} fps · ` : ''}{f.ext.toUpperCase()} · {f.video || 'no video'} / {f.audio || 'no audio'}</p>)}</div></details>}
        </AdvancedSettings>
        {source && o.fps && !fps.includes(o.fps) && <p className="setting-dependency-note">Your saved frame rate is unavailable for this link. <button type="button" className="text-button" onClick={() => update({ fps: undefined })}>Use source frame rate</button></p>}
      </>}
      {section === 'audio' && <>
        <Choices label="Audio format" value={p.audioContainer} values={formats('audio')} onChange={value => r.setPreferences(previous => ({ ...previous, audioContainer: value as Container }))} hint="MP3 is widely supported. WAV and FLAC preserve decoded audio without restoring quality missing from the source."/>
        <Choices label="Audio quality" value={o.preset} values={[[ 'best', 'Best available' ], [ 'smaller', 'Smaller file' ]]} onChange={value => update({ preset: value as Output['preset'] })} essential hint="This quality preset also applies to video downloads."/>
        {originalAudio && <p id={originalAudioHintId} className="setting-dependency-note">Original keeps the source bitrate, sample rate and channels. Choose another audio format to change these settings.</p>}
        {losslessAudio && <p id={losslessAudioHintId} className="setting-dependency-note">{p.audioContainer.toUpperCase()} does not use a target bitrate. Sample rate and channels remain adjustable under Advanced audio.</p>}
        <Choices label="Audio bitrate (kbps)" disabled={originalAudio || losslessAudio} describedBy={bitrateDescription} value={String(originalAudio || losslessAudio ? '' : o.audioBitrate || '')} values={[[ '', 'Automatic' ], ...[96,128,192,256,320].map(n => [String(n), String(n)] as [string,string])]} onChange={value => update({ audioBitrate: Number(value) || undefined })} hint="Automatic keeps compatible audio or chooses an encoding bitrate. Higher bitrates cannot restore missing source quality."/>
        {opusRateMismatch && <p className="setting-dependency-note" role="status">Your saved sample rate is not supported by Opus. <button type="button" className="text-button" onClick={() => update({ sampleRate: 48000 })}>Use 48 kHz</button></p>}
        <AdvancedSettings label="Advanced audio">
        <Choices label="Sample rate" disabled={originalAudio} disabledValues={opusRateMismatch ? [String(o.sampleRate)] : []} describedBy={audioDescription} value={String(originalAudio ? '' : o.sampleRate || '')} values={sampleRates} onChange={value => update({ sampleRate: Number(value) || undefined })} essential={originalAudio || p.audioContainer === 'opus'} hint={originalAudio ? 'Original keeps the source sample rate.' : p.audioContainer === 'opus' ? 'Use Source for automatic handling, or choose 48 kHz.' : undefined}/>
        <Choices label="Channels" disabled={originalAudio} describedBy={audioDescription} value={String(originalAudio ? '' : o.channels || '')} values={[[ '', 'Source' ], [ '1', 'Mono' ], [ '2', 'Stereo' ]]} onChange={value => update({ channels: Number(value) || undefined })} essential={originalAudio} hint={originalAudio ? 'Original keeps the source channels.' : undefined}/>
        <Select label="Audio language" value={o.language || ''} onChange={value => update({ language: value || undefined })} hint="Available tracks appear after checking a link."><option value="">Source default</option>{[...new Set([...(o.language ? [o.language] : []), ...languages])].map(l => <option key={l} value={l}>{l}{source && !languages.includes(l) ? ' (unavailable)' : ''}</option>)}</Select>
        </AdvancedSettings>
        {source && o.language && !languages.includes(o.language) && <p className="setting-dependency-note">Your saved audio language is unavailable for this link. <button type="button" className="text-button" onClick={() => update({ language: undefined })}>Use source language</button></p>}
      </>}
      {section === 'metadata' && <>
        <Toggle label="Include metadata" checked={!!o.metadata} onChange={metadata => update({ metadata })} hint="Keep available title and creator information in the output file."/>
        <Toggle label="Include chapters" checked={!!o.chapters} onChange={chapters => update({ chapters })} hint="Preserve source chapters when supported by the chosen format."/>
        <Toggle label="Include cover art (MP3 / M4A)" checked={!!o.cover} onChange={cover => update({ cover })} hint="Add artwork to MP3 or M4A files when the source provides it."/>
        <Select label="Subtitles" value={o.subtitle || ''} onChange={value => update({ subtitle: value || undefined })} hint="Check a link to see its subtitle languages."><option value="">None</option>{[...new Set([...(o.subtitle ? [o.subtitle] : []), ...(source?.subtitles || [])])].map(l => <option key={l} value={l}>{l}{source && !source.subtitles.includes(l) ? ' (unavailable)' : ''}</option>)}</Select>
        {!source && <p className="setting-dependency-note">Check a link on the Download page to see its subtitle languages. Collections are checked per item.</p>}
        {source && o.subtitle && !source.subtitles.includes(o.subtitle) && <p className="setting-dependency-note">Your saved subtitles are unavailable for this link. Choose None or an available language.</p>}
        {o.subtitle && <Choices label="Subtitle format" value={o.subtitleFormat || 'embedded'} values={[[ 'embedded', 'Embedded' ], [ 'srt', 'SRT' ], [ 'vtt', 'WebVTT' ]]} onChange={value => update({ subtitleFormat: value as Output['subtitleFormat'] })}/>}
      </>}
      {section === 'privacy' && <div className="settings-privacy"><div><h3>Local means local.</h3><p>Files chosen from your device are converted in your browser. They are not uploaded. Reselect them after a refresh.</p></div><div><h3>Public links use our service.</h3><p>Submitted links contact Clyvora infrastructure and the source platform. Remote files expire after 24 hours; job and session metadata after seven days.</p></div><div><h3>Your preferences stay here.</h3><p>Theme and output choices are saved in this browser. Remote jobs use an anonymous session. Private, authenticated, paid, and DRM-protected content is unsupported.</p></div></div>}
      {section === 'local' && <div className="settings-prose"><SectionHeading id="on-device">On-device conversion</SectionHeading><p>Files selected from your device are processed in your browser. Their contents and names stay on this device. Select them again after a refresh.</p><a className="setting-action" href="/local">Open local conversion <span aria-hidden="true">↗</span></a><SectionHeading id="remote-processing">Public-link processing</SectionHeading><p>Clyvora’s media service checks public links. Compatible downloads and joining audio with video can run in your browser; other downloads use the service.</p><p>Choose local-file output options on the Convert page. Audio, Video and Metadata settings here apply to public links.</p></div>}
      {section === 'instances' && <div className="settings-prose">
        <SectionHeading id="service">Processing service</SectionHeading><div className="service-connection"><span className={r.caps ? 'connection-dot connected' : 'connection-dot'}/><strong>Clyvora media service</strong><span>{r.caps ? 'Details loaded' : 'Details unavailable'}</span></div>
        <p>This service checks public links and handles downloads that need server processing.</p>
        <SectionHeading id="limits">Current limits</SectionHeading>{r.caps ? <dl className="diagnostic-list"><div><dt>Maximum collection</dt><dd>{r.caps.limits.items} items</dd></div><div><dt>Maximum source duration</dt><dd>{Math.floor(r.caps.limits.duration / 60)} minutes</dd></div><div><dt>Maximum item size</dt><dd>{Math.round(r.caps.limits.itemBytes / 1024 ** 2)} MiB</dd></div></dl> : <p>Limits appear when the service returns its details. You can still <a href="/local">convert local files</a> in your browser.</p>}
        <p>Source restrictions, service load and conversion settings affect speed. Temporary files can disappear during a server replacement.</p><a href="/about/privacy">Read about remote processing and retention</a>
      </div>}
      {section === 'advanced' && <>
        <SectionHeading id="settings-data">Settings data</SectionHeading><div className="settings-data-actions"><button type="button" onClick={() => importFile.current?.click()}>↥ Import</button><button type="button" onClick={exportSettings}>↧ Export</button><button type="button" onClick={() => setConfirm('reset')}>↺ Reset</button><input ref={importFile} type="file" accept="application/json,.json" hidden onChange={event => { void importSettings(event.target.files?.[0]); event.currentTarget.value = '' }}/></div><p className="setting-hint">Exports include output and interface preferences only. Jobs, links, files and session access are excluded.</p>
        <SectionHeading id="local-storage">Local storage</SectionHeading><button type="button" className="setting-action" onClick={() => setConfirm('cache')}>Clear application cache</button><p className="setting-hint">Remove cached site assets and conversion engines. Your session, preferences and job history remain available.</p>
      </>}
      {section === 'debug' && <div className="settings-prose"><SectionHeading id="application">Application</SectionHeading><dl className="diagnostic-list"><div><dt>Version</dt><dd>{version}</dd></div><div><dt>Media API</dt><dd>{r.caps ? `v${r.caps.apiVersion}` : 'Unavailable'}</dd></div><div><dt>Extraction engine</dt><dd>{r.caps?.engine || 'Unavailable'}</dd></div><div><dt>WebAssembly</dt><dd>{typeof WebAssembly === 'object' ? 'Available' : 'Unavailable'}</dd></div><div><dt>Isolated browser context</dt><dd>{typeof window !== 'undefined' && window.crossOriginIsolated ? 'Yes' : 'No'}</dd></div></dl><SectionHeading id="reporting">Reporting a problem</SectionHeading><p>Include your output settings, browser and the error shown. Do not share download grants, session cookies, private links or personal files.</p><a href="/about/community">Help &amp; feedback</a></div>}
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </section>}
    {confirm && <Panel title={confirm === 'reset' ? 'Reset preferences' : 'Clear application cache'} onClose={() => setConfirm(null)}><p>{confirm === 'reset' ? 'Restore default output and interface preferences? Your jobs and files will be kept.' : 'Remove cached application assets? Conversion engines will download again when needed. Jobs and preferences will be kept.'}</p><div className="job-actions"><button type="button" className="secondary-button" onClick={() => setConfirm(null)}>Keep current settings</button><button type="button" className="primary-button" onClick={() => void confirmed()}>{confirm === 'reset' ? 'Reset preferences' : 'Clear cache'}</button></div></Panel>}
  </div>
}
