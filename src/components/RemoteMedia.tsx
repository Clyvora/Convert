import Services from './Services'
import About from './AboutPage'
export { About }
import { compatibility, containers } from '../core/remoteContracts'
import type { Container, Mode, Output } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import { remoteMedia } from '../core/mediaClient'
import { formatBytes } from '../core/format'
import { ThemeToggle } from '../ThemeToggle'
import Panel from './Panel'
import { Icon } from './Icon'
import Mascot from './Mascot'
import Updates from './Updates'

const modeLabels = { auto: 'Auto', audio: 'Audio', video: 'Video only' } as const
export default function RemoteMedia({ controller: r, active }: { controller: RemoteController; active: boolean }) {
  return <>
    <section className="download-workspace" hidden={!active} aria-label="Public media downloads">
      <button type="button" className="services-trigger" onClick={() => r.setPanel('services')}><Icon name="plus"/>Supported services</button>
      <div className="download-stage">
        <Mascot className="download-companion" pose={r.error ? 'confused' : r.checking ? 'curious' : r.activeCount > 0 ? 'working' : r.jobs[0]?.state === 'ready' ? 'ready' : 'sitting'}/>
        <form className="omnibox" onSubmit={event => { event.preventDefault(); if (!r.busy) void (r.url.trim() ? r.submit() : r.paste()) }}>
          <label className="sr-only" htmlFor="remote-url">Public media link</label>
          <div className={`url-field ${r.checking ? 'is-checking' : ''}`}><Icon name="link"/><input id="remote-url" type="url" value={r.url} onChange={e => r.setURL(e.target.value)} placeholder="Paste the link here" autoComplete="off" spellCheck={false} disabled={r.busy} aria-describedby="download-feedback" />{r.url && !r.busy && <button type="button" className="clear-input" onClick={() => r.setURL('')} aria-label="Clear link">×</button>}</div>
          <div className="omnibox-actions"><fieldset className="mode-switch"><legend className="sr-only">Download mode</legend>{(['auto', 'audio', 'video'] as const).map(mode => <label key={mode} className={r.preferences.mode === mode ? 'selected' : ''}><input type="radio" name="download-mode" aria-label={modeLabels[mode]} value={mode} checked={r.preferences.mode === mode} onChange={() => r.setPreferences(current => ({ ...current, mode }))} /><span className="mode-symbol" aria-hidden="true">{mode === 'auto' ? '✧' : mode === 'audio' ? '♫' : '◫'}</span>{modeLabels[mode]}</label>)}</fieldset>
            <button className="primary-button quick-action" type="submit" disabled={r.busy}>{r.busy ? 'Working…' : r.url.trim() ? 'Download' : 'Paste'}<Icon name={r.url.trim() ? 'arrow' : 'link'}/></button></div>
        </form>
        <div id="download-feedback" className="download-feedback" aria-live="polite">{r.error && <p className="error-message" role="alert">{r.error}</p>}{!r.error && r.status && <p role="status">{r.status}</p>}{r.checking && <button className="text-button" type="button" onClick={r.cancelCheck}>Cancel check</button>}{r.discovery && r.panel !== 'collection' && <button className="text-button" type="button" onClick={() => r.setPanel('collection')}>Open collection · {r.discovery.count} discovered</button>}</div>
        {r.needsChoice && r.inspection && <div className="choice-preview"><Metadata controller={r}/><p>Adjust your output settings, then choose Download again.</p><button className="secondary-button" type="button" onClick={() => r.setPanel('settings')}>Choose output settings</button></div>}
      </div>
      <p className="workspace-note"><button type="button" className="text-button" onClick={() => r.setPanel('about')}>About &amp; privacy</button></p>
    </section>
    {r.panel && <Panel key={r.panel} placement={r.panel === 'queue' || r.panel === 'services' ? r.panel : 'drawer'} title={{ settings: 'Settings', queue: 'Downloads', services: 'Supported services', collection: 'Choose collection items', about: 'About Convert', updates: 'Updates' }[r.panel]} onClose={() => r.setPanel(null)}>
      {r.panel === 'settings' && <Settings controller={r}/>}{r.panel === 'queue' && <Downloads controller={r}/>}{r.panel === 'services' && <Services/>}{r.panel === 'collection' && <Collection controller={r}/>}{r.panel === 'about' && <About/>}{r.panel === 'updates' && <Updates/>}
    </Panel>}
  </>
}
function Metadata({ controller: r }: { controller: RemoteController }) {
  const i = r.inspection
  if (!i) return null
  return <div className="preview-heading">{i.thumbnail && <img src={remoteMedia.preview(i.thumbnail)} alt="" width="64" height="64"/>}<div><p className="eyebrow">{i.provider}{i.creator ? ` · ${i.creator}` : ''}</p><h3>{i.title}</h3>{i.duration !== null && <p className="muted">{Math.round(i.duration)} seconds</p>}</div></div>
}
export function Settings({ controller: r, expanded = false }: { controller: RemoteController; expanded?: boolean }) {
  const { preferences: p, inspection: i } = r, o = p.options
  const update = (patch: Partial<Output>) => r.setPreferences(current => ({ ...current, options: { ...current.options, ...patch } }))
  const formats = (kind: 'audio' | 'video') => (r.caps?.containers || containers).filter(f => f === 'original' || compatibility[f].kind === kind)
  const heights = [...new Set(i?.formats.filter(f => f.video).map(f => f.height).filter((h): h is number => h !== null) || [])].sort((a,b) => b-a)
  const fps = [...new Set(i?.formats.filter(f => f.video && (!o.height || f.height === o.height)).map(f => f.fps).filter((f): f is number => f !== null) || [])].sort((a,b) => b-a)
  const languages = [...new Set(i?.formats.map(f => f.language).filter((l): l is string => !!l) || [])]
  return <div className="settings-content">
    <div id="appearance" className="settings-intro"><p>Set your defaults. New downloads use these settings.</p><ThemeToggle/></div>
    <section id="output" className="settings-section"><h3>Output</h3>
      <label>Video format<select value={p.videoContainer} onChange={e => r.setPreferences(current => ({ ...current, videoContainer: e.target.value as Container }))}>{formats('video').map(f => <option key={f} value={f}>{f === 'original' ? 'Original / best container' : f.toUpperCase()}</option>)}</select></label>
      <label>Audio format<select value={p.audioContainer} onChange={e => r.setPreferences(current => ({ ...current, audioContainer: e.target.value as Container }))}>{formats('audio').map(f => <option key={f} value={f}>{f === 'original' ? 'Original / best container' : f.toUpperCase()}</option>)}</select></label>
      <label>Quality<select value={o.preset} onChange={e => update({ preset: e.target.value as Output['preset'] })}><option value="best">Best available</option><option value="smaller">Smaller file</option></select></label>
      <label>Resolution<select value={o.height || ''} onChange={e => update({ height: Number(e.target.value) || undefined, fps: undefined })}><option value="">Source available</option>{[...new Set([...(o.height ? [o.height] : []), ...heights])].map(h => <option key={h} value={h}>{h}p{heights.length && !heights.includes(h) ? ' — unavailable for this source' : ''}</option>)}</select></label>
      {!i && <p className="field-note">Source-specific resolutions and languages appear after checking a link.</p>}
    </section>
    <details id="video" open={expanded || undefined} className="settings-section"><summary>Advanced video</summary>
      <label>Video codec<select value={o.videoCodec || ''} onChange={e => update({ videoCodec: e.target.value as Output['videoCodec'] || undefined })}><option value="">Compatible automatic</option><option value="source">Preserve source codec</option><option value="h264">H.264</option><option value="vp9">VP9</option><option value="av1">AV1</option></select></label>
      <label>Frame rate<select value={o.fps || ''} onChange={e => update({ fps: Number(e.target.value) || undefined })}><option value="">Source available</option>{[...new Set([...(o.fps ? [o.fps] : []), ...fps])].map(f => <option key={f} value={f}>{f} fps</option>)}</select></label>
    </details>
    <details id="audio" open={expanded || undefined} className="settings-section"><summary>Advanced audio</summary>
      <label>Audio bitrate<select value={o.audioBitrate || ''} onChange={e => update({ audioBitrate: Number(e.target.value) || undefined })}><option value="">Preserve when compatible</option>{[96,128,192,256,320].map(b => <option key={b} value={b}>{b} kbps</option>)}</select></label>
      <label>Sample rate<select value={o.sampleRate || ''} onChange={e => update({ sampleRate: Number(e.target.value) || undefined })}><option value="">Source</option><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select></label>
      <label>Channels<select value={o.channels || ''} onChange={e => update({ channels: Number(e.target.value) || undefined })}><option value="">Source</option><option value="1">Mono</option><option value="2">Stereo</option></select></label>
      <label>Audio language<select value={o.language || ''} onChange={e => update({ language: e.target.value || undefined })}><option value="">Source default</option>{[...new Set([...(o.language ? [o.language] : []), ...languages])].map(l => <option key={l}>{l}</option>)}</select></label>
    </details>
    <details id="extras" open={expanded || undefined} className="settings-section"><summary>Subtitles &amp; extras</summary>
      <label>Subtitles<select value={o.subtitle || ''} onChange={e => update({ subtitle: e.target.value || undefined })}><option value="">None</option>{[...new Set([...(o.subtitle ? [o.subtitle] : []), ...(i?.subtitles || [])])].map(l => <option key={l}>{l}</option>)}</select></label>
      {o.subtitle && <label>Subtitle format<select value={o.subtitleFormat || 'embedded'} onChange={e => update({ subtitleFormat: e.target.value as Output['subtitleFormat'] })}><option value="embedded">Embed in media</option><option value="srt">SRT sidecar</option><option value="vtt">WebVTT sidecar</option></select></label>}
      <label className="check-field"><input type="checkbox" checked={!!o.metadata} onChange={e => update({ metadata: e.target.checked })}/>Include metadata</label><label className="check-field"><input type="checkbox" checked={!!o.chapters} onChange={e => update({ chapters: e.target.checked })}/>Include chapters</label><label className="check-field"><input type="checkbox" checked={!!o.cover} onChange={e => update({ cover: e.target.checked })}/>Include cover art <small>MP3 / M4A</small></label>
    </details>
    {i && <details className="settings-section"><summary>Available source media</summary><div className="source-formats">{i.formats.map(f => <p key={f.id}>{f.height ? `${f.height}p · ` : ''}{f.fps ? `${f.fps} fps · ` : ''}{f.ext.toUpperCase()} · {f.video || 'no video'} / {f.audio || 'no audio'}{f.size ? ` · ${f.sizeKind === 'estimated' ? 'approximately ' : ''}${formatBytes(f.size)}` : ' · size unknown'}</p>)}</div></details>}
    <p className="field-note">Saved on this device. Higher bitrates and lossless formats cannot restore missing source quality. Existing jobs keep their original settings.</p>
  </div>
}
function Downloads({ controller: r }: { controller: RemoteController }) {
  return <div className="download-list">
    {!r.jobs.length && <div className="panel-empty"><Mascot pose="sleeping"/><h3>Nothing here yet</h3><p>Your downloads will appear here, ready when you are.</p></div>}
    {r.error && <p className="error-message" role="alert">{r.error}</p>}
    {r.jobs.map(job => <article className="download-item" key={job.id}>
      <div className="job-heading"><h3>{job.total === 1 ? 'Media download' : `${job.total} collection items`}</h3><span className={`state-badge state-${job.state}`}>{job.state}</span></div>
      <p role="status">{job.stage}</p><p className="muted">{job.output.container.toUpperCase()} · {job.completed}/{job.total} completed{job.failed ? ` · ${job.failed} failed` : ''}</p>
      {job.bytes > 0 && !['ready','partial','failed','cancelled','expired'].includes(job.state) && <p className="muted">{formatBytes(job.bytes)}{job.totalBytes ? ` / ${formatBytes(job.totalBytes)}` : ''}</p>}
      {!!job.totalBytes && ['downloading','processing'].includes(job.state) && <progress value={job.bytes} max={job.totalBytes} aria-label="Download progress"/>}{job.error && <p className="error-message">{job.error.message}</p>}
      <div className="job-actions">{job.artifactId && ['ready','partial'].includes(job.state) && <button type="button" className="primary-button" disabled={r.busy} onClick={() => void r.download(job.artifactId!)}>Download {job.total > 1 ? 'ZIP' : 'file'}</button>}
        {!['ready','partial','failed','cancelled','expired'].includes(job.state) && <button className="secondary-button" type="button" disabled={r.busy} onClick={() => void r.cancel(job.id)}>Cancel</button>}{['failed','partial','cancelled','interrupted'].includes(job.state) && <button className="secondary-button" type="button" disabled={r.busy} onClick={() => void r.retry(job.id)}>Retry failed items</button>}
        <button type="button" className="text-button" onClick={() => void r.itemResults(job.id)}>Item results</button>{['ready','partial','failed','cancelled','expired'].includes(job.state) && <button type="button" className="text-button" disabled={r.busy} onClick={() => void r.remove(job.id)}>Remove</button>}
      </div>
    </article>)}
    {r.results && <section className="item-results"><div className="job-heading"><h3>Item results</h3><button type="button" className="text-button" onClick={() => r.setResults(null)}>Close results</button></div>{r.results.page.items.map(item => <article key={item.id}><p>{item.title}</p><p className="muted">{item.state}{item.error ? ` · ${item.error.message}` : ''}</p><div className="job-actions">{item.artifactId && <button className="secondary-button" type="button" onClick={() => void r.download(item.artifactId!)}>Download file</button>}{item.subtitleArtifactId && <button className="secondary-button" type="button" onClick={() => void r.download(item.subtitleArtifactId!)}>Download subtitles</button>}</div></article>)}{r.results.page.next && <button type="button" className="secondary-button" onClick={() => void r.itemResults(r.results!.id, r.results!.page.next!)}>Next results</button>}</section>}
    {r.jobs.length > 0 && <p className="field-note">Files expire after 24 hours. If a download doesn’t start automatically, use its download button.</p>}
  </div>
}
function Collection({ controller: r }: { controller: RemoteController }) {
  return <div className="collection-content"><Metadata controller={r}/><p>Choose the public items you want. Discovery depends on the source.</p>
    <div className="collection-filters"><label>Item limit<input type="number" min="1" max="1000" value={r.limit} onChange={e => r.setLimit(Number(e.target.value))}/></label><label>Published after<input type="date" value={r.after} onChange={e => r.setAfter(e.target.value)}/></label><label>Published before<input type="date" value={r.before} onChange={e => r.setBefore(e.target.value)}/></label></div><p className="field-note">Items without a publication date remain included.</p>
    <button type="button" className="secondary-button" disabled={r.busy || r.discovery?.state === 'discovering'} onClick={() => void r.discover()}>Discover collection</button>
    {r.discovery && <><p role="status">{r.discovery.count} discovered · {r.discovery.outcome}</p>{r.discovery.error && <p className="error-message">{r.discovery.error.message}</p>}{r.discovery.state === 'discovering' && <button type="button" className="text-button" onClick={() => void r.cancelDiscovery()}>Stop discovery</button>}
      <div className="job-actions"><button type="button" className="text-button" onClick={() => { r.setAll(true); r.setExcluded(new Set()) }}>Select all discovered</button><button type="button" className="text-button" onClick={() => { r.setAll(false); r.setSelected(new Set()); r.setExcluded(new Set()) }}>Deselect all</button></div>
      <div className="collection-items">{r.page.items.map(item => <label key={item.id} className="collection-row"><input type="checkbox" checked={r.all ? !r.excluded.has(item.id) : r.selected.has(item.id)} onChange={e => { const values = new Set(r.all ? r.excluded : r.selected); if (r.all ? !e.target.checked : e.target.checked) values.add(item.id); else values.delete(item.id); if (r.all) r.setExcluded(values); else r.setSelected(values) }}/><span>{item.title}</span></label>)}</div>
      <div className="job-actions"><button className="text-button" type="button" onClick={() => void r.loadPage()}>First page / refresh</button>{r.page.next && <button className="text-button" type="button" onClick={() => void r.loadPage(r.page.next!)}>Next page</button>}</div>
      <label>Collection output<select value={r.batchMode} onChange={e => r.setBatchMode(e.target.value as Mode)}><option value="combined">Video + audio</option><option value="audio">Audio</option><option value="video">Video only</option></select></label><p className="field-note">Shared output settings are checked per item. Incompatible items report a failure; completed items remain available.</p>
      <button className="primary-button" type="button" disabled={r.busy || r.discovery.state === 'discovering' || (!r.all && !r.selected.size)} onClick={() => void r.createCollection()}>Download selected items</button>
    </>}{r.error && <p className="error-message" role="alert">{r.error}</p>}
  </div>
}
