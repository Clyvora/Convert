import { MorphText } from './MorphText'
import Mascot from './components/Mascot'
import { Icon } from './components/Icon'
import { ChoiceGroup } from './ChoiceGroup'
import { memo, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { detectFile, FileDetectionError } from './core/detection'
import { formatBytes } from './core/format'
import { assessMemoryRisk, formatDuration } from './core/metrics'
import { outputFilename, uniqueFilename } from './core/naming'
import { mergePreferences, preferenceSubset } from './core/preferences'
import { readInterfacePreferences } from './core/interfacePreferences'
import { readVideoMetadata } from './core/localMetadata'
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
  '.mp3', '.wav', '.ogg', '.opus', '.mp4', '.webm', '.mkv', '.m4a', '.aac', '.flac', '.ts',
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
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
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

function LocalConverter({ active, onShow }: { active: boolean; onShow: () => void }) {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [dropActive, setDropActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false), [cancelling, setCancelling] = useState(false)
  const busyRef = useRef(false), importing = useRef<AbortController | null>(null), mounted = useRef(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  const [initialPreferences] = useState(loadPreferences)
  const preferencesRef = useRef<SavedPreferences>(initialPreferences)
  const mediaEngineRef = useRef<ConversionEngine | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const cancelledBatchRef = useRef(false)
  const optionsRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => {
    if (!notice || notice.tone === 'error') return
    const timeout = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cancelledBatchRef.current = true
      importing.current?.abort()
      abortRef.current?.abort()
      mediaEngineRef.current?.dispose?.()
      for (const item of itemsRef.current) if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    }
  }, [])

  const selected = items.find((item) => item.id === selectedId) ?? null
  const activeCount = items.filter((item) => ['ready', 'failed', 'cancelled'].includes(item.status)).length
  const completedCount = items.filter((item) => item.status === 'completed').length
  const lossless = selected?.options.outputFormat === 'wav' || selected?.options.outputFormat === 'flac'
  const queueTitle = busy ? 'Converting your files…' : completedCount === items.length && items.length ? `${items.length} ${items.length === 1 ? 'file' : 'files'} complete.` : items.every(item => item.status === 'ready') ? `${items.length} ${items.length === 1 ? 'file' : 'files'} ready.` : 'Your conversion files'

  useEffect(() => { if (!active) setSelectedId(null) }, [active])

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
      requestAnimationFrame(() => { const trigger = returnFocusRef.current; if (trigger?.isConnected && !trigger.closest('[hidden]')) trigger.focus() })
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
    if (!files.length || importing.current || busyRef.current) return 0
    const controller = new AbortController()
    importing.current = controller; setAdding(true)
    setNotice(null)
    onShow()
    const additions: QueueItem[] = []
    const errors: string[] = []
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    for (const file of files) {
      if (controller.signal.aborted) break
      try {
        const detected = await detectFile(file)
        if (controller.signal.aborted) break
        const limit = detected.kind === 'video' ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES
        if (file.size > limit) throw new Error(`${detected.kind === 'video' ? 'Videos' : 'Audio files'} must be ${formatBytes(limit)} or smaller for reliable browser conversion.`)
        const metadata = detected.kind === 'video' ? await readVideoMetadata(file, controller.signal) : {}
        if (controller.signal.aborted) break
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
    importing.current = null
    if (mounted.current) setAdding(false)
    if (!mounted.current || controller.signal.aborted) return 0
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
    patchItem(id, { status: 'loading-engine', progress: null, error: undefined, phaseLabel: 'Loading local media engine' })
    try {
      const { MediaConversionEngine } = await import('./engines/audio')
      controller.signal.throwIfAborted()
      if (!mounted.current) return
      const engine = mediaEngineRef.current ?? new MediaConversionEngine()
      mediaEngineRef.current = engine
      const blob = await engine.convert(item.file, item.detected, item.options, controller.signal, (progress, label) => {
        if (!mounted.current || controller.signal.aborted) return
        patchItem(id, {
          status: label?.startsWith('Loading') ? 'loading-engine' : 'converting',
          progress: progress !== null && Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null,
          phaseLabel: label,
        })
      })
      controller.signal.throwIfAborted()
      if (!mounted.current) return
      const name = uniqueFilename(outputFilename(item.file.name, item.options.outputFormat), usedNames)
      usedNames.add(name.toLowerCase())
      const url = URL.createObjectURL(blob)
      patchItem(id, {
        status: 'completed', progress: 1, phaseLabel: undefined, outputBlob: blob, outputUrl: url,
        outputName: name, durationMs: performance.now() - startedAt,
      })
      if (readInterfacePreferences().autoDownload) triggerDownload(url, name)
    } catch (error) {
      const cancelled = controller.signal.aborted
      if (!mounted.current) return
      patchItem(id, {
        status: cancelled ? 'cancelled' : 'failed', progress: 0, phaseLabel: undefined,
        error: cancelled ? 'Conversion cancelled. You can retry immediately.' : friendlyError(error),
      })
    } finally {
      abortRef.current = null
      activeIdRef.current = null
    }
  }

  const convertAll = async () => {
    if (busyRef.current || importing.current) return
    busyRef.current = true
    setBusy(true)
    setCancelling(false)
    cancelledBatchRef.current = false
    const usedNames = new Set(itemsRef.current.flatMap((item) => item.outputName ? [item.outputName.toLowerCase()] : []))
    try {
      for (const item of itemsRef.current) {
        if (cancelledBatchRef.current || !mounted.current) break
        if (['ready', 'failed', 'cancelled'].includes(item.status)) {
          if (item.status !== 'ready') patchItem(item.id, { status: 'ready', error: undefined })
          await runOne(item.id, usedNames)
        }
      }
    } finally {
      busyRef.current = false
      if (mounted.current) { setBusy(false); setCancelling(false) }
    }
  }

  const cancel = () => {
    setCancelling(true)
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
    if (busyRef.current || importing.current) return
    for (const item of itemsRef.current) if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    apply({ type: 'reset' })
  }

  const convertAgain = (item: QueueItem) => {
    if (busyRef.current || importing.current) return
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    patchItem(item.id, { status: 'ready', progress: 0, outputUrl: undefined, outputBlob: undefined, outputName: undefined, durationMs: undefined, error: undefined })
  }

  return <div className="local-workspace" hidden={!active}>

    {adding && <p className="notice notice-info" role="status">Checking your files…</p>}

    {notice && <div className={`notice notice-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <span>{notice.message}</span>
      <button className="dismiss-button" type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="close"/></button>
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

        <button className="primary-button" type="button" disabled={adding} onClick={() => inputRef.current?.click()}>Choose files</button>
        <p className="field-note">or drop audio and video here</p>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
      </div>
      <p className="field-note">Audio up to {formatBytes(MAX_AUDIO_BYTES)} · Video up to {formatBytes(MAX_VIDEO_BYTES)}</p>
      <div className="local-explainer"><h3><Icon name="convert"/> A format that fits</h3><p>Convert your audio and video into a format your player or editor supports. Choose output settings after selecting your files.</p><h3><Icon name="about"/> Source quality matters</h3><p>Conversion can change quality. Bigger files and higher bitrates cannot restore detail missing from the original.</p><h3><Icon name="settings"/> On-device processing</h3><p>Your files stay in this browser. The conversion engine loads when needed, and processing speed depends on your device.</p></div>
    </section> : <section className="workspace" aria-labelledby="queue-title">
      <div className="workspace-heading">
        <Mascot className="local-queue-companion" pose={busy ? 'working' : items.some(item => item.status === 'failed') ? 'confused' : completedCount === items.length ? 'ready' : 'sitting'}/>
        <div>

          <h2 id="queue-title"><MorphText>{queueTitle}</MorphText></h2>
        </div>
        <button className="secondary-button" type="button" disabled={busy || adding} onClick={() => inputRef.current?.click()}>Add files</button>
        <button className="text-button" type="button" disabled={busy || adding} onClick={reset}>Clear files</button>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
      </div>

      <div className="queue" aria-label="Conversion files">
        {items.map((item) => <article className={`queue-item status-${item.status}`} key={item.id}>
          <div className="file-icon" aria-hidden="true"><Icon name={item.detected.kind === 'video' ? 'video' : 'audio'}/></div>
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
            <span className={`local-state state-badge state-${item.status}`}><MorphText>{statusLabel(item)}</MorphText></span>
            {(item.status === 'converting' || item.status === 'loading-engine') && <progress value={item.progress ?? undefined} max={1} aria-label={`Conversion progress for ${item.file.name}`} />}
            {item.status === 'completed' && item.outputUrl && item.outputName && <>
              <small>{formatBytes(item.outputBlob?.size ?? 0)} · {formatDuration(item.durationMs)}</small>
              <button className="download-button" type="button" onClick={() => triggerDownload(item.outputUrl!, item.outputName!)}>Download</button>
              <button className="text-button" type="button" disabled={busy || adding} onClick={() => convertAgain(item)}>Convert again</button>
            </>}
          </div>
          <button className="remove-button dismiss-button" type="button" disabled={item.id === activeIdRef.current} onClick={() => remove(item)} aria-label={`Remove ${item.file.name}`}><Icon name="close"/></button>
        </article>)}
      </div>

      <div className="queue-actions">
        <p aria-live="polite"><MorphText>{`${completedCount} complete · ${activeCount} available to convert`}</MorphText></p>
        <div>
          {busy ? <button className="danger-button" type="button" disabled={cancelling} onClick={cancel}>{cancelling ? 'Stopping…' : 'Cancel conversion'}</button>
            : <button className="primary-button" type="button" disabled={activeCount === 0 || adding} onClick={() => void convertAll()}><MorphText>{activeCount ? `Convert ${activeCount}` : 'Convert'}</MorphText></button>}
        </div>
      </div>
      <p className="field-note">Your files stay on this device. Save converted files before closing or refreshing this tab.</p>
    </section>}


    {selected && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null) }}>
      <div ref={optionsRef} className="options-dialog" role="dialog" aria-modal="true" aria-labelledby="options-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Conversion options</p><h2 id="options-title">{selected.file.name}</h2></div>
          <button className="remove-button dismiss-button" type="button" onClick={() => setSelectedId(null)} aria-label="Close options"><Icon name="close"/></button>
        </div>
        <div className="settings-body">
          <ChoiceGroup label="Output format" value={selected.options.outputFormat}
            choices={getOutputFormats(selected.detected.format).map(format => ({ value: format, label: format.toUpperCase() }))}
            onChange={value => updateOptions(selected, { outputFormat: value as ConversionOptions['outputFormat'] })} />
          <ChoiceGroup label="Audio quality" value={String(selected.options.audioBitrate)} disabled={lossless}
            choices={[
              { value: '128', label: 'Smaller', description: '128 kbps' },
              { value: '192', label: 'Balanced', description: '192 kbps' },
              { value: '320', label: 'Higher', description: '320 kbps' },
              ...(![128, 192, 320].includes(selected.options.audioBitrate) ? [{ value: String(selected.options.audioBitrate), label: 'Custom', description: `${selected.options.audioBitrate} kbps` }] : []),
            ]}
            onChange={value => updateOptions(selected, { audioBitrate: Number(value) as AudioBitrate })} />
          {lossless && <p className="field-note">Bitrate does not apply to {selected.options.outputFormat.toUpperCase()}. Channels and sample rate still affect the result.</p>}
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
                <select value={selected.options.audioBitrate} disabled={lossless} onChange={(event) => updateOptions(selected, { audioBitrate: Number(event.target.value) as AudioBitrate })}>
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

export default memo(LocalConverter)
