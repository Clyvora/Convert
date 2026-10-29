import { MorphText } from './MorphText'
import Mascot from './components/Mascot'
import { Icon } from './components/Icon'
import { ChoiceGroup } from './ChoiceGroup'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import './App.css'
import { detectFile, FileDetectionError } from './core/detection'
import { formatBytes } from './core/format'
import { assessMemoryRisk, formatDuration } from './core/metrics'
import { outputFilename, uniqueFilename } from './core/naming'
import { mergePreferences, preferenceSubset } from './core/preferences'
import type { SavedPreferences } from './core/preferences'
import { getOutputFormats, isVideoFormat } from './core/registry'
import { queueReducer } from './core/queue'
import type { QueueAction } from './core/queue'
import type {
  AudioBitrate,
  AudioChannels,
  AudioSampleRate,
  ConversionEngine,
  ConversionOptions,
  QueueItem,
  VideoQuality,
  VideoResolution,
} from './core/types'

const ACCEPT = [
  '.mp3', '.wav', '.ogg', '.opus', '.mp4', '.webm', '.mkv', '.m4a', '.aac', '.flac',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm',
].join(',')
const PREFERENCE_KEY = 'clyvora-convert-media-preferences-v2'
const MAX_AUDIO_BYTES = 300 * 1024 * 1024
const MAX_VIDEO_BYTES = 500 * 1024 * 1024
const AUDIO_BITRATES: AudioBitrate[] = [96, 128, 192, 256, 320]
const VIDEO_RESOLUTIONS: Array<{ label: string; value: VideoResolution }> = [
  { label: 'Original', value: 'original' },
  { label: '1080p', value: 1080 },
  { label: '720p', value: 720 },
  { label: '480p', value: 480 },
]
const VIDEO_QUALITIES: Array<{ label: string; value: VideoQuality }> = [
  { label: 'Smaller file', value: 'smaller' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Higher quality', value: 'high' },
]

interface Notice { message: string; tone: 'error' | 'success' | 'info' }

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Conversion cancelled. You can retry immediately.'
  if (error instanceof Error) return error.message
  return 'Conversion failed. The file may be damaged, unsupported, or too large for this browser.'
}

function loadPreferences(): SavedPreferences {
  try { return JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? '{}') as SavedPreferences } catch { return {} }
}

function savePreferences(preferences: SavedPreferences): void {
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Optional storage. */ }
}

function triggerDownload(url: string, name: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

function statusLabel(item: QueueItem): string {
  if (item.phaseLabel) return item.phaseLabel
  return {
    ready: 'Ready', 'loading-engine': 'Loading engine', converting: 'Converting', completed: 'Complete',
    failed: 'Needs attention', cancelled: 'Cancelled',
  }[item.status]
}

async function readVideoMetadata(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return {}
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const finish = (metadata: { width?: number; height?: number; duration?: number }) => {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(metadata)
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish({
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      duration: Number.isFinite(video.duration) ? video.duration : undefined,
    })
    video.onerror = () => finish({})
    video.src = url
  })
}

export default function LocalConverter({ active, onShow }: { active: boolean; onShow: () => void }) {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [dropActive, setDropActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  const preferencesRef = useRef<SavedPreferences>(loadPreferences())
  const mediaEngineRef = useRef<ConversionEngine | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const cancelledBatchRef = useRef(false)
  const optionsRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  useEffect(() => () => {
    abortRef.current?.abort()
    mediaEngineRef.current?.dispose?.()
    for (const item of itemsRef.current) if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
  }, [])

  const selected = items.find((item) => item.id === selectedId) ?? null
  const activeCount = items.filter((item) => ['ready', 'failed', 'cancelled'].includes(item.status)).length
  const completedCount = items.filter((item) => item.status === 'completed').length

  useEffect(() => {
    if (!selectedId) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = optionsRef.current
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), summary'
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(selector) ?? []).filter(element => !element.closest('details:not([open])') || element.tagName === 'SUMMARY')
    requestAnimationFrame(() => focusables()[0]?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setSelectedId(null); return }
      if (event.key !== 'Tab') return
      const elements = focusables()
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }, [selectedId])

  const apply = (action: QueueAction) => {
    itemsRef.current = queueReducer(itemsRef.current, action)
    dispatch(action)
  }
  const patchItem = (id: string, patch: Partial<QueueItem>) => apply({ type: 'update', id, patch })

  const updateOptions = (item: QueueItem, patch: Partial<ConversionOptions>) => {
    const options = { ...item.options, ...patch }
    patchItem(item.id, { options })
    preferencesRef.current = { ...preferencesRef.current, [item.detected.format]: preferenceSubset(options) }
    savePreferences(preferencesRef.current)
  }

  const addFiles = useCallback(async (files: File[]) => {
    onShow()
    const additions: QueueItem[] = []
    const errors: string[] = []
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    for (const file of files) {
      try {
        const detected = await detectFile(file)
        const limit = detected.kind === 'video' ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES
        if (file.size > limit) throw new Error(`${detected.kind === 'video' ? 'Videos' : 'Audio files'} must be ${formatBytes(limit)} or smaller for reliable browser conversion.`)
        const metadata = detected.kind === 'video' ? await readVideoMetadata(file) : {}
        const risk = assessMemoryRisk(file.size, detected.kind, deviceMemory)
        additions.push({
          id: makeId(), file, detected, options: mergePreferences(detected.format, preferencesRef.current),
          status: 'ready', progress: 0,
          warning: risk.level === 'heavy' ? `${risk.label}: ${risk.detail}` : undefined,
          sourceWidth: metadata.width, sourceHeight: metadata.height, sourceDurationSeconds: metadata.duration,
        })
      } catch (error) {
        const message = error instanceof FileDetectionError || error instanceof Error ? error.message : 'Could not inspect this file.'
        errors.push(`${file.name}: ${message}`)
      }
    }
    if (additions.length) apply({ type: 'add', items: additions })
    if (errors.length) setNotice({ message: errors.join(' '), tone: 'error' })
    return additions.length
  }, [onShow])

  const runOne = async (id: string, usedNames: Set<string>): Promise<void> => {
    const item = itemsRef.current.find((entry) => entry.id === id)
    if (!item || item.status === 'completed') return
    const controller = new AbortController()
    const startedAt = performance.now()
    abortRef.current = controller
    activeIdRef.current = id
    patchItem(id, { status: 'loading-engine', progress: 0, error: undefined, phaseLabel: 'Loading local media engine' })
    try {
      const { MediaConversionEngine } = await import('./engines/audio')
      const engine = mediaEngineRef.current ?? new MediaConversionEngine()
      mediaEngineRef.current = engine
      const blob = await engine.convert(item.file, item.detected, item.options, controller.signal, (progress, label) => {
        patchItem(id, {
          status: label?.startsWith('Loading') ? 'loading-engine' : 'converting',
          progress: progress ?? 0,
          phaseLabel: label,
        })
      })
      controller.signal.throwIfAborted()
      const name = uniqueFilename(outputFilename(item.file.name, item.options.outputFormat), usedNames)
      usedNames.add(name.toLowerCase())
      const url = URL.createObjectURL(blob)
      patchItem(id, {
        status: 'completed', progress: 1, phaseLabel: undefined, outputBlob: blob, outputUrl: url,
        outputName: name, durationMs: performance.now() - startedAt,
      })
      triggerDownload(url, name)
    } catch (error) {
      const cancelled = controller.signal.aborted
      patchItem(id, {
        status: cancelled ? 'cancelled' : 'failed', progress: 0, phaseLabel: undefined,
        error: friendlyError(error),
      })
    } finally {
      abortRef.current = null
      activeIdRef.current = null
    }
  }

  const convertAll = async () => {
    if (busy) return
    setBusy(true)
    cancelledBatchRef.current = false
    const usedNames = new Set(itemsRef.current.flatMap((item) => item.outputName ? [item.outputName.toLowerCase()] : []))
    for (const item of itemsRef.current) {
      if (cancelledBatchRef.current) break
      if (['ready', 'failed', 'cancelled'].includes(item.status)) {
        if (item.status !== 'ready') patchItem(item.id, { status: 'ready', error: undefined })
        await runOne(item.id, usedNames)
      }
    }
    setBusy(false)
  }

  const cancel = () => {
    cancelledBatchRef.current = true
    abortRef.current?.abort()
    mediaEngineRef.current?.cancel?.()
    apply({ type: 'cancelQueued' })
  }

  const remove = (item: QueueItem) => {
    if (item.id === activeIdRef.current) return
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    apply({ type: 'remove', id: item.id })
  }

  const reset = () => {
    if (busy) return
    for (const item of itemsRef.current) if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    apply({ type: 'reset' })
  }

  return <div className="local-workspace" hidden={!active}>

    {notice && <div className={`notice notice-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <span>{notice.message}</span>
      <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button>
    </div>}

    {items.length === 0 ? <section className="local-empty" aria-labelledby="local-title">
      <Mascot pose="local"/>
      <h2 id="local-title">Keep it local.</h2>
      <p>Audio and video conversion, right on your device.</p>
      <div
        className={`drop-zone ${dropActive ? 'drop-active' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDropActive(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropActive(false) }}
        onDrop={(event) => { event.preventDefault(); setDropActive(false); void addFiles(Array.from(event.dataTransfer.files)) }}
      >

        <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>Choose files</button>
        <p className="field-note">or drop audio and video here</p>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
      </div>
      <p className="field-note">Audio up to {formatBytes(MAX_AUDIO_BYTES)} · Video up to {formatBytes(MAX_VIDEO_BYTES)}</p>
      <div className="local-explainer"><h3><Icon name="convert"/> A format that fits</h3><p>Convert your audio and video into a format your player or editor supports. Choose output settings after selecting your files.</p><h3><Icon name="about"/> Source quality matters</h3><p>Conversion can change quality. Bigger files and higher bitrates cannot restore detail missing from the original.</p><h3><Icon name="settings"/> On-device processing</h3><p>Your files stay in this browser. The conversion engine loads when needed, and processing speed depends on your device.</p></div>
    </section> : <section className="workspace" aria-labelledby="queue-title">
      <div className="workspace-heading">
        <Mascot className="local-queue-companion" pose={busy ? 'working' : items.some(item => item.status === 'failed') ? 'confused' : completedCount === items.length ? 'ready' : 'sitting'}/>
        <div>

          <h2 id="queue-title"><MorphText>{`${items.length} ${items.length === 1 ? 'file' : 'files'} ready.`}</MorphText></h2>
        </div>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>Add files</button>
        <button className="text-button" type="button" disabled={busy} onClick={reset}>Clear files</button>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
      </div>

      <div className="queue" aria-label="Conversion files">
        {items.map((item) => <article className={`queue-item status-${item.status}`} key={item.id}>
          <div className="file-icon" aria-hidden="true">{item.detected.kind === 'video' ? '▶' : '♫'}</div>
          <div className="file-details">
            <h2>{item.file.name}</h2>
            <p>{formatBytes(item.file.size)} · {item.detected.format.toUpperCase()}{item.sourceDurationSeconds ? ` · ${Math.round(item.sourceDurationSeconds)}s` : ''}</p>
            {item.warning && <p className="warning">{item.warning}</p>}
            {item.error && <p className="error-text" role="alert">{item.error}</p>}
          </div>
          <label className="format-select">
            <span className="sr-only">Output format for {item.file.name}</span>
            <select value={item.options.outputFormat} disabled={busy || item.status === 'completed'} onChange={(event) => updateOptions(item, { outputFormat: event.target.value as ConversionOptions['outputFormat'] })}>
              {getOutputFormats(item.detected.format).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
            </select>
          </label>
          <button className="icon-button" type="button" disabled={busy || item.status === 'completed'} onClick={() => setSelectedId(item.id)} aria-label={`Options for ${item.file.name}`}>Options</button>
          <div className="item-status" aria-live="polite">
            <MorphText>{statusLabel(item)}</MorphText>
            {(item.status === 'converting' || item.status === 'loading-engine') && <progress value={item.progress} max={1} aria-label={`Conversion progress for ${item.file.name}`} />}
            {item.status === 'completed' && item.outputUrl && item.outputName && <>
              <small>{formatBytes(item.outputBlob?.size ?? 0)} · {formatDuration(item.durationMs)}</small>
              <button className="download-button" type="button" onClick={() => triggerDownload(item.outputUrl!, item.outputName!)}>Download</button>
            </>}
          </div>
          <button className="remove-button" type="button" disabled={item.id === activeIdRef.current} onClick={() => remove(item)} aria-label={`Remove ${item.file.name}`}>×</button>
        </article>)}
      </div>

      <div className="queue-actions">
        <p aria-live="polite"><MorphText>{`${completedCount} complete · ${activeCount} available to convert`}</MorphText></p>
        <div>
          {busy ? <button className="danger-button" type="button" onClick={cancel}>Cancel conversion</button>
            : <button className="primary-button" type="button" disabled={activeCount === 0} onClick={() => void convertAll()}><MorphText>{activeCount ? `Convert ${activeCount}` : 'Convert'}</MorphText></button>}
        </div>
      </div>
    </section>}


    {selected && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null) }}>
      <div ref={optionsRef} className="options-dialog" role="dialog" aria-modal="true" aria-labelledby="options-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Conversion options</p><h2 id="options-title">{selected.file.name}</h2></div>
          <button className="remove-button" type="button" onClick={() => setSelectedId(null)} aria-label="Close options">×</button>
        </div>
        <div className="settings-body">
          <ChoiceGroup label="Output format" value={selected.options.outputFormat}
            choices={getOutputFormats(selected.detected.format).map(format => ({ value: format, label: format.toUpperCase() }))}
            onChange={value => updateOptions(selected, { outputFormat: value as ConversionOptions['outputFormat'] })} />
          <ChoiceGroup label="Audio quality" value={String(selected.options.audioBitrate)}
            choices={[
              { value: '128', label: 'Smaller', description: '128 kbps' },
              { value: '192', label: 'Balanced', description: '192 kbps' },
              { value: '320', label: 'Higher', description: '320 kbps' },
              ...(![128, 192, 320].includes(selected.options.audioBitrate) ? [{ value: String(selected.options.audioBitrate), label: 'Custom', description: `${selected.options.audioBitrate} kbps` }] : []),
            ]}
            onChange={value => updateOptions(selected, { audioBitrate: Number(value) as AudioBitrate })} />
          {isVideoFormat(selected.options.outputFormat) && <>
            <ChoiceGroup label="Video quality" value={selected.options.videoQuality}
              choices={VIDEO_QUALITIES.map(quality => ({ value: quality.value, label: quality.label }))}
              onChange={value => updateOptions(selected, { videoQuality: value as VideoQuality })} />
            <label className="setting-field">Maximum resolution
              <select value={selected.options.videoResolution} onChange={(event) => updateOptions(selected, { videoResolution: event.target.value === 'original' ? 'original' : Number(event.target.value) as VideoResolution })}>
                {VIDEO_RESOLUTIONS.map((resolution) => <option key={resolution.value} value={resolution.value}>{resolution.label}</option>)}
              </select>
            </label>
          </>}
          <details className="advanced-settings">
            <summary>Advanced audio <span aria-hidden="true">+</span></summary>
            <div className="option-grid">
              <label>Audio bitrate
                <select value={selected.options.audioBitrate} onChange={(event) => updateOptions(selected, { audioBitrate: Number(event.target.value) as AudioBitrate })}>
                  {AUDIO_BITRATES.map((bitrate) => <option key={bitrate} value={bitrate}>{bitrate} kbps</option>)}
                </select>
              </label>
              <label>Channels
                <select value={selected.options.audioChannels} onChange={(event) => updateOptions(selected, { audioChannels: (event.target.value === 'source' ? 'source' : Number(event.target.value)) as AudioChannels })}>
                  <option value="source">Keep source</option><option value="1">Mono</option><option value="2">Stereo</option>
                </select>
              </label>
              <label>Sample rate
                <select value={selected.options.audioSampleRate} onChange={(event) => updateOptions(selected, { audioSampleRate: (event.target.value === 'source' ? 'source' : Number(event.target.value)) as AudioSampleRate })}>
                  <option value="source">Keep source</option><option value="44100">{['opus', 'webm'].includes(selected.options.outputFormat) ? '44.1 → 48 kHz (Opus)' : '44.1 kHz'}</option><option value="48000">48 kHz</option>
                </select>
              </label>
            </div>
          </details>
        </div>
        <div className="settings-footer"><p className="dialog-note">Saved automatically on this device.</p>
        <button className="primary-button" type="button" onClick={() => setSelectedId(null)}>Done</button></div>
      </div>
    </div>}
  </div>
}
