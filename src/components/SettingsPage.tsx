import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { compatibility, containers } from '../core/remoteContracts'
import type { Container, Output } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import { PageDirectory, SectionHeading } from './PagePrimitives'
import { useSectionNavigation } from '../core/navigation'
import { interfaceDefaults, saveInterfacePreferences, useInterfacePreferences } from '../core/interfacePreferences'
import { initialPreferences } from '../core/remotePreferences'
import { parseOutput } from '../core/remoteContracts'
import Panel from './Panel'

const sections = [
  { id: 'appearance', label: 'Appearance', icon: '☀', group: 0 },
  { id: 'accessibility', label: 'Accessibility', icon: '◎', group: 0 },
  { id: 'video', label: 'Video', icon: '▣', group: 1 },
  { id: 'audio', label: 'Audio', icon: '♫', group: 1 },
  { id: 'metadata', label: 'Metadata', icon: '≡', group: 1 },
  { id: 'local', label: 'Local processing', icon: '▤', group: 2 },
  { id: 'instances', label: 'Processing service', icon: '◉', group: 2 },
  { id: 'privacy', label: 'Privacy', icon: '♧', group: 3 },
  { id: 'advanced', label: 'Advanced', icon: '☷', group: 3 },
  { id: 'debug', label: 'App information', icon: '⌘', group: 3 },
] as const
const sectionIds = sections.map(s => s.id)
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')

function Choices({ label, value, values, onChange, hint, disabled = false }: { label: string; value: string; values: [string, string][]; onChange: (value: string) => void; hint?: string; disabled?: boolean }) {
  const name = useId()
  return <div className="setting-block"><SectionHeading id={slug(label)}>{label}</SectionHeading><fieldset className="setting-choices" disabled={disabled}><legend className="sr-only">{label}</legend><div className="setting-segments">{values.map(([id, text]) => <label key={id} className={id === value ? 'is-selected' : ''}><input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)}/><span>{text}</span></label>)}</div></fieldset>{hint && <p className="setting-hint">{hint}</p>}</div>
}
function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint: string }) {
  return <div className="setting-block"><label className="setting-toggle"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)}/><span className="toggle-track" aria-hidden="true"/></label><p className="setting-hint">{hint}</p></div>
}
function Select({ label, children, value, onChange, hint }: { label: string; children: ReactNode; value: string | number; onChange: (value: string) => void; hint?: string }) {
  return <div className="setting-block"><label className="setting-select"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>{hint && <p className="setting-hint">{hint}</p>}</div>
}

export default function SettingsPage({ controller: r }: { controller: RemoteController }) {
  const section = useSectionNavigation('/settings', sectionIds, 'appearance', { output: 'video', extras: 'metadata' })
  const [ui, setUI] = useInterfacePreferences()
  const [theme, setTheme] = useState(() => localStorage.getItem('clyvora-theme') || 'dark')
  const [notice, setNotice] = useState(''), [confirm, setConfirm] = useState<'reset' | 'cache' | null>(null)
  const importFile = useRef<HTMLInputElement>(null)
  const p = r.preferences, o = p.options, i = r.inspection
  const update = (patch: Partial<Output>) => r.setPreferences(previous => ({ ...previous, options: { ...previous.options, ...patch } }))
  const formats = (kind: 'audio' | 'video'): [string, string][] => (r.caps?.containers || containers).filter(f => f === 'original' || compatibility[f].kind === kind).map(f => [f, f === 'original' ? 'Original' : f.toUpperCase()])
  const heights = [...new Set(i?.formats.filter(f => f.video).map(f => f.height).filter((h): h is number => h !== null) || [])].sort((a,b) => b-a)
  const fps = [...new Set(i?.formats.filter(f => f.video && (!o.height || f.height === o.height)).map(f => f.fps).filter((f): f is number => f !== null) || [])].sort((a,b) => b-a)
  const languages = [...new Set(i?.formats.map(f => f.language).filter((l): l is string => !!l) || [])]
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
  return <div className={`settings-studio directory-layout ${ui.showHelp ? 'show-explanations' : ''}`}>
    <PageDirectory title="Settings" version="v0.3 · beta" base="/settings" entries={sections} selected={section}/>
    <section key={section} className="settings-detail" data-category={section} aria-label={`${sections.find(s => s.id === section)!.label} settings`}>
      <h2 className="sr-only">{sections.find(s => s.id === section)!.label}</h2>
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
        <Choices label="Quality" value={o.preset} values={[[ 'best', 'Best available' ], [ 'smaller', 'Smaller file' ]]} onChange={value => update({ preset: value as Output['preset'] })} hint="The smaller-file preset favors a lighter download. It may require processing."/>
        <Choices label="Resolution" value={String(o.height || '')} values={[[ '', 'Source' ], ...[...new Set([...(o.height ? [o.height] : []), ...heights])].map(h => [String(h), `${h}p`] as [string,string])]} onChange={value => update({ height: Number(value) || undefined, fps: undefined })} hint={i ? 'Only source resolutions are offered. An unavailable saved choice requires your approval to change.' : 'Inspect a link to see its available resolutions. We never upscale the source.'}/>
        <Choices label="Video codec" value={o.videoCodec || ''} values={[[ '', 'Auto' ], [ 'source', 'Source' ], [ 'h264', 'H.264' ], [ 'vp9', 'VP9' ], [ 'av1', 'AV1' ]]} onChange={value => update({ videoCodec: value as Output['videoCodec'] || undefined })} hint="Auto chooses a compatible codec. Preserving the source can avoid a costly conversion."/>
        <Select label="Frame rate" value={o.fps || ''} onChange={value => update({ fps: Number(value) || undefined })}><option value="">Source</option>{[...new Set([...(o.fps ? [o.fps] : []), ...fps])].map(f => <option key={f} value={f}>{f} fps</option>)}</Select>
        {i && <details className="setting-source"><summary>Available source media</summary><div className="source-formats">{i.formats.map(f => <p key={f.id}>{f.height ? `${f.height}p · ` : ''}{f.fps ? `${f.fps} fps · ` : ''}{f.ext.toUpperCase()} · {f.video || 'no video'} / {f.audio || 'no audio'}</p>)}</div></details>}
      </>}
      {section === 'audio' && <>
        <Choices label="Audio format" value={p.audioContainer} values={formats('audio')} onChange={value => r.setPreferences(previous => ({ ...previous, audioContainer: value as Container }))} hint="MP3 is widely supported. WAV and FLAC preserve decoded audio without restoring quality missing from the source."/>
        <Choices label="Audio quality" value={o.preset} values={[[ 'best', 'Best available' ], [ 'smaller', 'Smaller file' ]]} onChange={value => update({ preset: value as Output['preset'] })} hint="The quality preset is shared with video downloads."/>
        <Choices label="Audio bitrate (kbps)" disabled={p.audioContainer === 'original'} value={String(p.audioContainer === 'original' ? '' : o.audioBitrate || '')} values={[[ '', 'Source' ], ...[96,128,192,256,320].map(n => [String(n), String(n)] as [string,string])]} onChange={value => update({ audioBitrate: Number(value) || undefined })} hint="Original preserves source audio for faster downloads. Choose another format to change bitrate, sample rate or channels."/>
        <Choices label="Sample rate" disabled={p.audioContainer === 'original'} value={String(p.audioContainer === 'original' ? '' : o.sampleRate || '')} values={[[ '', 'Source' ], [ '44100', '44.1 kHz' ], [ '48000', '48 kHz' ]]} onChange={value => update({ sampleRate: Number(value) || undefined })}/>
        <Choices label="Channels" disabled={p.audioContainer === 'original'} value={String(p.audioContainer === 'original' ? '' : o.channels || '')} values={[[ '', 'Source' ], [ '1', 'Mono' ], [ '2', 'Stereo' ]]} onChange={value => update({ channels: Number(value) || undefined })}/>
        <Select label="Audio language" value={o.language || ''} onChange={value => update({ language: value || undefined })} hint="Available tracks appear after inspecting a link."><option value="">Source default</option>{[...new Set([...(o.language ? [o.language] : []), ...languages])].map(l => <option key={l}>{l}</option>)}</Select>
      </>}
      {section === 'metadata' && <>
        <Toggle label="Include metadata" checked={!!o.metadata} onChange={metadata => update({ metadata })} hint="Keep available title and creator information in the output file."/>
        <Toggle label="Include chapters" checked={!!o.chapters} onChange={chapters => update({ chapters })} hint="Preserve source chapters when supported by the chosen format."/>
        <Toggle label="Include cover art (MP3 / M4A)" checked={!!o.cover} onChange={cover => update({ cover })} hint="Add artwork to MP3 or M4A files when the source provides it."/>
        <Select label="Subtitles" value={o.subtitle || ''} onChange={value => update({ subtitle: value || undefined })} hint="Inspect a link to see available subtitle languages."><option value="">None</option>{[...new Set([...(o.subtitle ? [o.subtitle] : []), ...(i?.subtitles || [])])].map(l => <option key={l}>{l}</option>)}</Select>
        {o.subtitle && <Choices label="Subtitle format" value={o.subtitleFormat || 'embedded'} values={[[ 'embedded', 'Embedded' ], [ 'srt', 'SRT' ], [ 'vtt', 'WebVTT' ]]} onChange={value => update({ subtitleFormat: value as Output['subtitleFormat'] })}/>}
      </>}
      {section === 'privacy' && <div className="settings-privacy"><div><h3>Local means local.</h3><p>Files chosen from your device are converted in your browser. They are not uploaded. Reselect them after a refresh.</p></div><div><h3>Public links use our service.</h3><p>Submitted links contact Clyvora infrastructure and the source platform. Remote files expire after 24 hours; job and session metadata after seven days.</p></div><div><h3>Your preferences stay here.</h3><p>Theme and output choices are saved in this browser. Remote jobs use an anonymous session. Private, authenticated, paid, and DRM-protected content is unsupported.</p></div></div>}
      {section === 'local' && <div className="settings-prose"><SectionHeading id="on-device">On-device conversion</SectionHeading><p>Files selected from your device are processed locally with FFmpeg WebAssembly. Their contents and names are not uploaded.</p><a className="setting-action" href="/local">Open local conversion <span aria-hidden="true">↗</span></a><SectionHeading id="remote-processing">Public-link processing</SectionHeading><p>Public-link extraction and conversion run on Clyvora’s media service. Switching this page does not turn remote downloads into local processing.</p><p>Local files must be reselected after a refresh. Available formats depend on the installed browser processing build.</p></div>}
      {section === 'instances' && <div className="settings-prose"><SectionHeading id="service">Processing service</SectionHeading><div className="service-connection"><span className={r.caps ? 'connection-dot connected' : 'connection-dot'}/><strong>Clyvora media service</strong><span>{r.caps ? 'Connected' : 'Connecting'}</span></div><p>Public links use the protected Clyvora API. There is no server key to enter or custom instance to configure.</p><SectionHeading id="limits">Current limits</SectionHeading>{r.caps ? <dl className="diagnostic-list"><div><dt>Extraction engine</dt><dd>{r.caps.engine}</dd></div><div><dt>Maximum collection</dt><dd>{r.caps.limits.items} items</dd></div><div><dt>Maximum source duration</dt><dd>{Math.floor(r.caps.limits.duration / 60)} minutes</dd></div><div><dt>Maximum item size</dt><dd>{Math.round(r.caps.limits.itemBytes / 1024 ** 2)} MiB</dd></div></dl> : <p>Service information will appear when the connection is available.</p>}<p>Free hosting has limited processing capacity. Source restrictions, load and conversion settings affect speed. Temporary files can disappear during a server replacement.</p><a href="/about/privacy">Read about remote processing and retention</a></div>}
      {section === 'advanced' && <>
        <SectionHeading id="settings-data">Settings data</SectionHeading><div className="settings-data-actions"><button type="button" onClick={() => importFile.current?.click()}>↥ Import</button><button type="button" onClick={exportSettings}>↧ Export</button><button type="button" onClick={() => setConfirm('reset')}>↺ Reset</button><input ref={importFile} type="file" accept="application/json,.json" hidden onChange={event => { void importSettings(event.target.files?.[0]); event.currentTarget.value = '' }}/></div><p className="setting-hint">Exports include output and interface preferences only. Jobs, links, files and session access are excluded.</p>
        <SectionHeading id="local-storage">Local storage</SectionHeading><button type="button" className="setting-action" onClick={() => setConfirm('cache')}>Clear application cache</button><p className="setting-hint">Remove cached site assets and conversion engines. Your session, preferences and job history remain available.</p>
      </>}
      {section === 'debug' && <div className="settings-prose"><SectionHeading id="application">Application</SectionHeading><dl className="diagnostic-list"><div><dt>Version</dt><dd>0.3 · beta</dd></div><div><dt>Media API</dt><dd>{r.caps ? `v${r.caps.apiVersion}` : 'Unavailable'}</dd></div><div><dt>Extraction engine</dt><dd>{r.caps?.engine || 'Unavailable'}</dd></div><div><dt>WebAssembly</dt><dd>{typeof WebAssembly === 'object' ? 'Available' : 'Unavailable'}</dd></div><div><dt>Isolated browser context</dt><dd>{window.crossOriginIsolated ? 'Yes' : 'No'}</dd></div></dl><SectionHeading id="reporting">Reporting a problem</SectionHeading><p>Include your output settings, browser and the error shown. Do not share download grants, session cookies, private links or personal files.</p><a href="/about/community">Help &amp; feedback</a></div>}
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </section>
    {confirm && <Panel title={confirm === 'reset' ? 'Reset preferences' : 'Clear application cache'} onClose={() => setConfirm(null)}><p>{confirm === 'reset' ? 'Restore default output and interface preferences? Your jobs and files will be kept.' : 'Remove cached application assets? Conversion engines will download again when needed. Jobs and preferences will be kept.'}</p><div className="job-actions"><button type="button" className="secondary-button" onClick={() => setConfirm(null)}>Keep current settings</button><button type="button" className="primary-button" onClick={() => void confirmed()}>{confirm === 'reset' ? 'Reset preferences' : 'Clear cache'}</button></div></Panel>}
  </div>
}
