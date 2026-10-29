import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { compatibility, containers } from '../core/remoteContracts'
import type { Container, Output } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import Mascot from './Mascot'
import './SettingsPage.css'
import './SettingsPolish.css'

const sections = [
  { id: 'appearance', title: 'Appearance', icon: '☀', description: 'Make yourself at home.' },
  { id: 'video', title: 'Video', icon: '▣', description: 'Your picture. Your preferences.' },
  { id: 'audio', title: 'Audio', icon: '♫', description: 'Find your sound.' },
  { id: 'metadata', title: 'Metadata', icon: '≡', description: 'Keep the details that matter.' },
  { id: 'privacy', title: 'Privacy', icon: '◇', description: 'Know where your files go.' },
] as const
type Section = typeof sections[number]['id']
function currentSection(): Section {
  const hash = location.hash.slice(1)
  // Preserve links from the previous settings layout.
  if (hash === 'output') return 'video'
  if (hash === 'extras') return 'metadata'
  return sections.find(s => s.id === hash)?.id || 'appearance'
}

function Choices({ label, value, values, onChange, hint, disabled = false }: { label: string; value: string; values: [string, string][]; onChange: (value: string) => void; hint?: string; disabled?: boolean }) {
  const name = useId()
  return <div className="setting-block"><fieldset className="setting-choices" disabled={disabled}><legend>{label}</legend><div className="setting-segments">{values.map(([id, text]) => <label key={id} className={id === value ? 'is-selected' : ''}><input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)}/><span>{text}</span></label>)}</div></fieldset>{hint && <p className="setting-hint">{hint}</p>}</div>
}
function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint: string }) {
  return <div className="setting-block"><label className="setting-toggle"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)}/><span className="toggle-track" aria-hidden="true"/></label><p className="setting-hint">{hint}</p></div>
}
function Select({ label, children, value, onChange, hint }: { label: string; children: ReactNode; value: string | number; onChange: (value: string) => void; hint?: string }) {
  return <div className="setting-block"><label className="setting-select"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>{hint && <p className="setting-hint">{hint}</p>}</div>
}

export default function SettingsPage({ controller: r }: { controller: RemoteController }) {
  const [section, setSection] = useState(currentSection)
  const [showHelp, setShowHelp] = useState(false)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  useEffect(() => {
    const changed = () => setSection(currentSection())
    window.addEventListener('hashchange', changed)
    window.addEventListener('popstate', changed)
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed) }
  }, [])
  const p = r.preferences, o = p.options, i = r.inspection
  const update = (patch: Partial<Output>) => r.setPreferences(previous => ({ ...previous, options: { ...previous.options, ...patch } }))
  const formats = (kind: 'audio' | 'video'): [string, string][] => (r.caps?.containers || containers).filter(f => f === 'original' || compatibility[f].kind === kind).map(f => [f, f === 'original' ? 'Original' : f.toUpperCase()])
  const heights = [...new Set(i?.formats.filter(f => f.video).map(f => f.height).filter((h): h is number => h !== null) || [])].sort((a,b) => b-a)
  const fps = [...new Set(i?.formats.filter(f => f.video && (!o.height || f.height === o.height)).map(f => f.fps).filter((f): f is number => f !== null) || [])].sort((a,b) => b-a)
  const languages = [...new Set(i?.formats.map(f => f.language).filter((l): l is string => !!l) || [])]
  const selected = sections.find(s => s.id === section)!
  const chooseTheme = (value: string) => {
    setTheme(value); document.documentElement.dataset.theme = value
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'dark' ? '#151515' : '#fafafa')
    try { localStorage.setItem('clyvora-theme', value) } catch { /* Optional device preference. */ }
  }
  return <div className={`settings-studio ${showHelp ? 'show-explanations' : ''}`}>
    <aside className="settings-directory"><nav aria-label="Settings categories">{sections.map(s => <a key={s.id} href={`#${s.id}`} aria-current={section === s.id ? 'location' : undefined} onClick={() => setSection(s.id)}><span aria-hidden="true" className={`category-glyph category-${s.id}`}>{s.icon}</span>{s.title}</a>)}</nav><Mascot pose="local" className="settings-cat"/></aside>
    <section key={section} className="settings-detail" data-category={section} aria-label={`${selected.title} settings`}>
      <header className="settings-detail-heading"><span aria-hidden="true" className={`category-glyph category-${section}`}>{selected.icon}</span><div><h2>{selected.title}</h2></div><button className="settings-help-button" type="button" aria-pressed={showHelp} onClick={() => setShowHelp(value => !value)}>Help</button></header>
      {section === 'appearance' && <>
        <Choices label="Theme" value={theme} onChange={chooseTheme} values={[[ 'dark', 'Dark' ], [ 'light', 'Light' ]]} hint="A little easier on the eyes. Your choice stays with this browser."/>
        <div className="theme-sample" aria-hidden="true"><div className="sample-top"><span/><span/><span/></div><div className="sample-content"><Mascot pose="sitting"/><div className="sample-input">Paste the link here <span>↗</span></div><div className="sample-bottom"><span>Auto</span><span>Audio</span><strong>Download</strong></div></div></div>
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
      {section !== 'privacy' && <footer className="setting-hint">These defaults apply to new public-link jobs. Local conversion has its own file options.</footer>}
    </section>
  </div>
}
