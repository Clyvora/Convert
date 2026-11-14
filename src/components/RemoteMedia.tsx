import { splitLinks } from '../core/linkBatch'
import { youtubePlaylistURL } from '../core/collectionLinks'
import TransferProgress from './TransferProgress'
import About from './AboutPage'
export { About }
import { compatibility, containers } from '../core/remoteContracts'
import type { Container, Job, Mode, Output, State } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import { remoteMedia } from '../core/mediaClient'
import { formatBytes } from '../core/format'
import { ThemeToggle } from '../ThemeToggle'
import Panel from './Panel'
import { Icon } from './Icon'
import Mascot from './Mascot'
import Updates from './Updates'
import { MorphText } from '../MorphText'
import { useState } from 'react'
import ErrorDetails from './ErrorDetails'

const modeLabels = { auto: 'Auto', audio: 'Audio', video: 'Video only' } as const
const jobLabels: Record<State, string> = { created: 'Preparing', queued: 'Waiting', downloading: 'Downloading', processing: 'Preparing file', packaging: 'Packing files', ready: 'Ready to save', partial: 'Some items failed', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', expired: 'Expired' }
const activeStates: State[] = ['created', 'queued', 'downloading', 'processing', 'packaging']
export default function RemoteMedia({ controller: r, active }: { controller: RemoteController; active: boolean }) {
  return <>
    <section className="download-workspace" hidden={!active} aria-label="Public media downloads">
      <div className="download-stage">
        <Mascot className="download-companion" pose={r.error ? 'confused' : r.checking ? 'curious' : r.activeCount > 0 ? 'working' : r.jobs[0]?.state === 'ready' ? 'ready' : 'sitting'}/>
        <form className={splitLinks(r.url).length > 1 ? "omnibox is-batch" : "omnibox"} onSubmit={event => { event.preventDefault(); if (!r.busy) void (r.url.trim() ? r.submit() : r.paste()) }}>
          <label className="sr-only" htmlFor="remote-url">Public media link</label>
          <div className={`url-field ${r.checking ? 'is-checking' : ''}`}><Icon name="link"/><textarea id="remote-url" rows={Math.min(5, Math.max(1, r.url.split('\n').length))} value={r.url} onChange={e => r.setURL(e.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Paste links, one per line" autoComplete="off" spellCheck={false} disabled={r.busy} aria-describedby="download-feedback link-batch-hint" />{r.url && !r.busy && <button type="button" className="clear-input dismiss-button" onClick={() => r.setURL('')} aria-label="Clear link"><Icon name="close"/></button>}</div>
          <div className="omnibox-actions"><fieldset className="mode-switch" disabled={r.busy}><legend className="sr-only">Download mode</legend>{(['auto', 'audio', 'video'] as const).map(mode => <label key={mode} className={r.preferences.mode === mode ? 'selected' : ''}><input type="radio" name="download-mode" aria-label={modeLabels[mode]} value={mode} checked={r.preferences.mode === mode} onChange={() => r.setPreferences(current => ({ ...current, mode }))} /><span className="mode-symbol" aria-hidden="true"><Icon name={mode}/></span>{modeLabels[mode]}</label>)}</fieldset>
            <button className="primary-button quick-action" type="submit" disabled={r.busy}><MorphText>{r.addingLinks ? 'Adding links…' : r.checking ? 'Checking…' : r.busy ? 'Working…' : r.url.trim() ? splitLinks(r.url).length > 1 ? `Download ${splitLinks(r.url).length} links` : 'Download' : 'Paste'}</MorphText><Icon name={r.checking ? 'link' : r.url.trim() ? 'arrow' : 'link'}/></button></div>
        </form>
        <p id="link-batch-hint" className="field-note">Up to 20 links · one per line · Shift+Enter for a new line</p>
        {youtubePlaylistURL(r.url) && <p className="field-note playlist-choice">This link includes a playlist. <button type="button" className="text-button" disabled={r.busy} onClick={() => void r.openPlaylist()}>Choose playlist items</button></p>}
        <div id="download-feedback" className="download-feedback"><DownloadFeedback controller={r}/>{r.inspection?.provider === 'YouTube (Spotify match)' && <p className="muted">Audio matched on YouTube from your Spotify link.</p>}{r.checking && !r.addingLinks && <button className="text-button" type="button" onClick={r.cancelCheck}>Cancel check</button>}{r.discovery && r.panel !== 'collection' && <button className="text-button" type="button" onClick={() => r.setPanel('collection')}>Open collection · {r.discovery.count} discovered</button>}</div>
        {r.addingLinks && <button type="button" className="text-button" onClick={r.stopAddingLinks}>Stop adding links</button>}
        {r.linkResults.length > 0 && <ul className="link-batch-results" aria-label="Link results">{r.linkResults.map(item => <li key={item.url}><span className="link-batch-url">{item.url}</span><span>{({ waiting: 'Waiting', checking: 'Checking…', queued: 'Added to queue', failed: 'Could not add', cancelled: 'Stopped' })[item.state]}</span>{item.message && <p className="error-message">{item.message}</p>}</li>)}</ul>}
        {r.needsChoice && r.inspection && <div className="choice-preview"><Metadata controller={r}/><p>Adjust your output settings, then choose Download again.</p><button className="secondary-button" type="button" onClick={() => r.setPanel('settings')}>Choose output settings</button></div>}
      </div>
      <details className="download-guide"><summary>About this media downloader</summary><h2>Public media downloads and private file conversion</h2><p>mewvi is a free audio and video tool by Clyvora. Paste a supported public link, choose Auto, Audio or Video only, then download the result. No account is required.</p><p>Spotify track links use public song details to find matching audio on YouTube. The audio source is identified in the interface. Source availability and matching can vary.</p><p>Have a file already? <a href="/local">Convert audio and video locally</a> in your browser. Your selected local files stay on your device. Public-link downloads use our media service.</p><p>Use media you own or have permission to download. mewvi is in beta. Read <a href="/about">how it works</a>, the <a href="/about/privacy">privacy policy</a> and <a href="/about/terms">service limits</a>.</p></details>
      <p className="workspace-note"><button type="button" className="text-button" onClick={() => r.setPanel('about')}>About &amp; privacy</button></p>
    </section>
    {r.panel && r.panel !== 'services' && <Panel key={r.panel} placement={r.panel === 'queue' ? 'queue' : 'drawer'} title={{ settings: 'Settings', queue: 'Downloads', collection: 'Choose collection items', about: 'About mewvi', updates: 'Updates' }[r.panel]} onClose={() => r.setPanel(null)}>
      {r.panel === 'settings' && <Settings controller={r}/>}{r.panel === 'queue' && <Downloads controller={r}/>}{r.panel === 'collection' && <Collection controller={r}/>}{r.panel === 'about' && <About/>}{r.panel === 'updates' && <Updates/>}
    </Panel>}
  </>
}
function JobProgress({ job }: { job: Job }) {
  if (!['downloading', 'processing', 'packaging'].includes(job.state)) return null
  const measured = job.state === 'downloading' && !!job.totalBytes && job.totalBytes > 0
  const percent = measured ? Math.min(100, Math.max(0, Math.floor(job.bytes / job.totalBytes! * 100))) : null
  return <div className="job-progress">
    <progress aria-label={`${jobLabels[job.state]} progress`} value={measured ? job.bytes : undefined} max={measured ? job.totalBytes : undefined}/>
    {percent !== null && <span className="job-progress-numbers">{formatBytes(job.bytes)} / {formatBytes(job.totalBytes!)}<span>{percent}%</span></span>}
  </div>
}
function DownloadFeedback({ controller: r }: { controller: RemoteController }) {
  const working = r.queueJobs.find(job => activeStates.includes(job.state))
  const ready = r.queueJobs.find(job => ['ready', 'partial'].includes(job.state) && job.artifactId)
  const sent = r.status.startsWith('Download sent to your browser')
  if (!r.error && !r.status && !r.checking && !working && !ready) return null
  const tone = r.error ? 'error' : r.checking ? 'checking' : working ? 'active' : ready ? 'ready' : sent ? 'success' : 'info'
  const title = r.error ? 'Download needs attention' : r.checking ? r.addingLinks ? 'Checking links' : 'Checking link'
    : working ? jobLabels[working.state] : ready ? jobLabels[ready.state] : sent ? 'Sent to your browser' : null
  const message = r.error || (r.checking ? r.status === 'Checking your link…' ? 'Looking for available media and formats.' : r.status
    : working ? working.stage : ready ? 'Open downloads to save the finished files.' : sent ? 'Check your browser’s downloads for the file.' : r.status)
  const icon = tone === 'error' ? 'warning' : ['ready', 'success'].includes(tone) ? 'check' : tone === 'checking' ? 'link' : 'download'
  return <div className={`feedback-card feedback-${tone}`}>
    <Icon name={icon}/><div className="feedback-content">
      <div role={r.error ? 'alert' : 'status'} aria-atomic="true">{title && <strong>{title}</strong>}{message && message !== title && <p>{message}</p>}</div>
      {!r.error && !r.checking && working && <JobProgress job={working}/>}
      <div className="feedback-actions">
        {!r.checking && r.jobs.length > 0 && <button type="button" className="text-button" onClick={() => r.setPanel('queue')}>View downloads</button>}
        {r.error && r.url && !r.busy && <button type="button" className="text-button" onClick={() => { const input = document.getElementById('remote-url') as HTMLTextAreaElement | null; input?.focus(); input?.select() }}>Edit link</button>}
      </div>
      {r.error && <ErrorDetails area="download" code={r.errorCode} options={{...r.preferences.options,downloadMode:r.preferences.mode,videoContainer:r.preferences.videoContainer,audioContainer:r.preferences.audioContainer}} engine={r.caps?.engine}/>}
    </div>
  </div>
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
function DownloadFile({ controller: r, id, again = false }: { controller: RemoteController; id: string; again?: boolean }) {
  const local = remoteMedia.browserAccess?.(id)
  const label = again ? 'Download again' : 'Download file'
  if (local) return <a className="secondary-button" href={local.url} download={local.name} onClick={() => { window.setTimeout(() => remoteMedia.browserDelivered(id), 0) }}>{label}</a>
  return <button type="button" className="secondary-button" disabled={r.queueBusy(id)} onClick={() => void r.download(id)}>{label}</button>
}
function Downloads({ controller: r }: { controller: RemoteController }) {
  const resultsExpired = r.jobs.some(job => job.id === r.results?.id && job.state === 'expired')
  return <div className="download-list">
    {(r.retryableCount > 0 || r.recentCount > 0 || r.queueBatchStatus) && <div className="queue-batch-tools">
      <div className="job-actions">
        {r.retryableCount > 0 && <button type="button" className="secondary-button" disabled={Boolean(r.queueBatch)} onClick={() => void r.retryFailed()}>Retry failed downloads</button>}
        {r.recentCount > 0 && <button type="button" className="text-button" disabled={Boolean(r.queueBatch)} onClick={() => void r.clearRecent()}>Clear recent</button>}
        {r.queueBatch && <button type="button" className="text-button" onClick={r.stopQueueBatch}>Stop remaining</button>}
      </div>
      {r.recentCount > 0 && <p className="field-note">Clear recent removes transferred entries. Files waiting to be saved stay in the queue.</p>}
      {r.queueBatchStatus && <p role="status" className="field-note">{r.queueBatchStatus}</p>}
    </div>}
    {r.jobs.some(job => job.id.startsWith('browser-')) && <p className="field-note">Direct browser downloads stay available while this tab is open. Keep it open until your file is saved.</p>}
    {r.queueJobs.length > 0 && <Mascot className="queue-companion" pose={r.activeCount > 0 ? 'working' : r.queueJobs.some(job => ['failed', 'partial', 'interrupted'].includes(job.state)) ? 'confused' : r.queueJobs.some(job => job.state === 'ready') ? 'ready' : 'sleeping'}/>}
    {!r.queueJobs.length && <div className="panel-empty"><Mascot pose="sleeping"/><h3>{r.recentJobs.length ? 'All caught up' : 'Nothing here yet'}</h3>{!r.recentJobs.length && <p>Your downloads will appear here, ready when you are.</p>}</div>}
    {r.error && <div><p className="error-message" role="alert">{r.error}</p><ErrorDetails area="download" code={r.errorCode} options={{...r.preferences.options,downloadMode:r.preferences.mode,videoContainer:r.preferences.videoContainer,audioContainer:r.preferences.audioContainer}} engine={r.caps?.engine}/></div>}
    {r.queueJobs.map(job => <article className="download-item" key={job.id} aria-busy={r.queueBusy(job.id)}>
      <div className="job-heading"><h3>{job.title || (job.total === 1 ? 'Media download' : `${job.total} collection items`)}</h3><span className={`state-badge state-${job.state}`}>{jobLabels[job.state]}</span></div>
      <p role="status"><MorphText>{job.stage}</MorphText></p><p className="muted">{job.output.container.toUpperCase()} · <MorphText>{`${job.completed}/${job.total} completed${job.failed ? ` · ${job.failed} failed` : ''}`}</MorphText></p>
      {job.bytes > 0 && job.state === 'downloading' && !job.totalBytes && <p className="muted">{formatBytes(job.bytes)} downloaded · total size unknown</p>}
      <TransferProgress job={job}/>
      <JobProgress job={job}/>{job.error && <p className="error-message">{job.error.message}</p>}
      {['failed','partial','interrupted'].includes(job.state) && <ErrorDetails area="download" code={job.error?.code || (job.state === 'partial' ? 'PARTIAL_FAILURE' : 'DOWNLOAD_INTERRUPTED')} state={job.state} options={job.output} engine={r.caps?.engine}/>}
      {job.state === 'expired' && <p className="field-note">This file is no longer available. Add the original link again to make a new download.</p>}
      {r.downloadNeedsAction.has(job.id) && <p role="status">If your download did not start, select Download file or allow automatic downloads for mewvi.</p>}
      <div className="job-actions">{job.artifactId && ['ready','partial'].includes(job.state) && (job.total === 1 ? <DownloadFile controller={r} id={job.artifactId}/> : <button type="button" className="primary-button" disabled={r.queueBusy(job.id)} onClick={() => void r.download(job.artifactId!)}>Download ZIP</button>)}
        {!['ready','partial','failed','cancelled','expired'].includes(job.state) && <button className="secondary-button" type="button" disabled={r.queueBusy(job.id)} onClick={() => void r.cancel(job.id)}>Cancel</button>}{['failed','partial','cancelled','interrupted'].includes(job.state) && <button className="secondary-button" type="button" disabled={r.queueBusy(job.id)} onClick={() => void r.retry(job.id)}>{job.total === 1 ? 'Retry download' : job.failed ? 'Retry failed items' : 'Retry unfinished items'}</button>}
        <button type="button" className="text-button" disabled={r.queueBusy(`items:${job.id}`)} onClick={() => void r.itemResults(job.id)}>Item results</button>{['ready','partial','failed','cancelled','expired'].includes(job.state) && <button type="button" className="text-button" disabled={r.queueBusy(job.id)} onClick={() => void r.remove(job.id)}>Remove</button>}
      </div>
    </article>)}
    {r.recentJobs.length > 0 && <details className="recent-downloads"><summary>Recent downloads ({r.recentJobs.length})</summary>{r.recentJobs.map(job => <article className="download-item" key={job.id}>
      <div className="job-heading"><h3>{job.title || (job.total === 1 ? 'Media download' : `${job.total} collection items`)}</h3>{job.state === 'expired' && <span className="state-badge">expired</span>}</div>
      <div className="job-actions">{job.state === 'ready' && job.artifactId && <DownloadFile controller={r} id={job.artifactId} again/>}<button type="button" className="text-button" disabled={r.queueBusy(`items:${job.id}`)} onClick={() => void r.itemResults(job.id)}>Item results</button><button type="button" className="text-button" disabled={r.queueBusy(job.id)} onClick={() => void r.remove(job.id)}>Remove</button></div>
    </article>)}</details>}
    {r.results && <section className="item-results" aria-busy={r.resultsBusy}><div className="job-heading"><h3>Item results</h3><button type="button" className="text-button" onClick={() => r.setResults(null)}>Close results</button></div>{r.results.page.items.map(item => <article key={item.id}><p>{item.title}</p><p className="muted">{resultsExpired ? 'Expired' : item.state ? jobLabels[item.state] : ''}{item.error ? ` · ${item.error.message}` : ''}</p><div className="job-actions">{!resultsExpired && item.artifactId && item.state === 'ready' && <DownloadFile controller={r} id={item.artifactId}/>}{!resultsExpired && item.subtitleArtifactId && item.state === 'ready' && <button className="secondary-button" type="button" disabled={r.queueBusy(item.subtitleArtifactId)} onClick={() => void r.download(item.subtitleArtifactId!)}>Download subtitles</button>}</div></article>)}{r.results.page.next && <button type="button" className="secondary-button" disabled={r.resultsBusy} onClick={() => void r.itemResults(r.results!.id, r.results!.page.next!)}>Next results</button>}</section>}
    {r.jobs.length > 0 && <p className="field-note">Files expire after 24 hours. If a download doesn’t start automatically, use its download button.</p>}
  </div>
}
function Collection({ controller: r }: { controller: RemoteController }) {
  const [query, setQuery] = useState('')
  const visible = r.page.items.filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selectedCount = r.all ? Math.max(0, (r.discovery?.count || 0) - r.excluded.size) : r.selected.size
  const chooseVisible = (choose: boolean) => {
    const values = new Set(r.all ? r.excluded : r.selected)
    for (const item of visible) { if (r.all ? !choose : choose) values.add(item.id); else values.delete(item.id) }
    if (r.all) r.setExcluded(values); else r.setSelected(values)
  }
  return <div className="collection-content"><div className="collection-overview"><Mascot pose={r.discovery?.state === 'discovering' ? 'working' : 'curious'}/><Metadata controller={r}/></div><p>Choose the public items you want. Discovery depends on the source.</p>
    <div className="collection-filters"><label>Item limit<input type="number" min="1" max="1000" value={r.limit} onChange={e => r.setLimit(Number(e.target.value))}/></label><label>Published after<input type="date" value={r.after} onChange={e => r.setAfter(e.target.value)}/></label><label>Published before<input type="date" value={r.before} onChange={e => r.setBefore(e.target.value)}/></label></div><p className="field-note">Items without a publication date remain included.</p>
    <button type="button" className="secondary-button" disabled={r.busy || r.discovery?.state === 'discovering'} onClick={() => void r.discover()}>Discover collection</button>
    {r.discovery && <><p role="status">{r.discovery.count} discovered · {r.discovery.outcome}</p>{r.discovery.error && <p className="error-message">{r.discovery.error.message}</p>}{r.discovery.state === 'discovering' && <button type="button" className="text-button" onClick={() => void r.cancelDiscovery()}>Stop discovery</button>}
      <label>Search this page<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter item titles"/></label>
      <p className="field-note" role="status">{selectedCount} selected across this collection · {visible.length} shown on this page</p>
      <div className="job-actions"><button type="button" className="text-button" onClick={() => { r.setAll(true); r.setExcluded(new Set()) }}>Select all discovered</button><button type="button" className="text-button" onClick={() => { r.setAll(false); r.setSelected(new Set()); r.setExcluded(new Set()) }}>Deselect all</button><button type="button" className="text-button" disabled={!visible.length} onClick={() => chooseVisible(true)}>Select visible items</button><button type="button" className="text-button" disabled={!visible.length} onClick={() => chooseVisible(false)}>Deselect visible items</button></div>
      <div className="collection-items">{visible.map(item => <label key={item.id} className="collection-row"><input type="checkbox" checked={r.all ? !r.excluded.has(item.id) : r.selected.has(item.id)} onChange={e => { const values = new Set(r.all ? r.excluded : r.selected); if (r.all ? !e.target.checked : e.target.checked) values.add(item.id); else values.delete(item.id); if (r.all) r.setExcluded(values); else r.setSelected(values) }}/><span>{item.title}</span></label>)}</div>
      {!visible.length && <p className="field-note">No matching items on this page.</p>}
      <div className="job-actions"><button className="text-button" type="button" onClick={() => void r.loadPage()}>First page / refresh</button>{r.page.next && <button className="text-button" type="button" onClick={() => void r.loadPage(r.page.next!)}>Next page</button>}</div>
      <label>Collection output<select value={r.batchMode} onChange={e => r.setBatchMode(e.target.value as Mode)}><option value="combined">Video + audio</option><option value="audio">Audio</option><option value="video">Video only</option></select></label><p className="field-note">Shared output settings are checked per item. Incompatible items report a failure; completed items remain available.</p>
      <button className="primary-button" type="button" disabled={r.busy || r.discovery.state === 'discovering' || selectedCount === 0} onClick={() => void r.createCollection()}>Download selected items</button>
    </>}{r.error && <p className="error-message" role="alert">{r.error}</p>}
  </div>
}
