import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import { detectFile, FileDetectionError } from './core/detection'
import { formatBytes } from './core/format'
import { assessMemoryRisk, calculateSizeChange, formatDuration } from './core/metrics'
import { outputFilename, uniqueFilename } from './core/naming'
import { applyCompatibleSettings, mergePreferences, preferenceSubset } from './core/preferences'
import type { SavedPreferences } from './core/preferences'
import { getOutputFormats, isImageFormat } from './core/registry'
import { queueReducer } from './core/queue'
import type { QueueAction } from './core/queue'
import type { ConversionEngine, ConversionOptions, MediaFormat, QueueItem } from './core/types'

const ACCEPT = '.png,.jpg,.jpeg,.webp,.mp3,.wav,image/png,image/jpeg,image/webp,audio/mpeg,audio/wav'
const PREFERENCE_KEY = 'clyvora-convert-preferences-v1'

interface OfflineReadiness {
  appCached: boolean
  audioCached: boolean
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Conversion cancelled. You can retry when ready.'
  if (error instanceof Error) return error.message
  return 'Conversion failed. The source may be damaged or too large for this browser.'
}

function loadPreferences(): SavedPreferences {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? '{}') as SavedPreferences
  } catch {
    return {}
  }
}

function savePreferences(preferences: SavedPreferences): void {
  try {
    localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences))
  } catch {
    // Preferences are a convenience. Conversion still works when storage is blocked.
  }
}

async function readImageDimensions(blob: Blob): Promise<{ width?: number; height?: number }> {
  if (!('createImageBitmap' in globalThis)) return {}
  try {
    const bitmap = await createImageBitmap(blob)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch {
    return {}
  }
}

async function createSampleFile(): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 600
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not create the sample image.')
  context.fillStyle = '#090a0a'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = 'rgba(238,234,224,.12)'
  context.lineWidth = 1
  for (let x = 0; x <= canvas.width; x += 48) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke()
  }
  for (let y = 0; y <= canvas.height; y += 48) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke()
  }
  context.strokeStyle = 'rgba(238,234,224,.38)'
  context.beginPath(); context.arc(760, 280, 210, 0, Math.PI * 2); context.stroke()
  context.fillStyle = '#eeeae0'
  context.font = '300 72px system-ui'
  context.fillText('Clyvora Convert', 64, 260)
  context.fillStyle = '#9a9891'
  context.font = '24px system-ui'
  context.fillText('A locally generated sample image.', 68, 310)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create the sample image.')), 'image/png'))
  canvas.width = 1
  canvas.height = 1
  return new File([blob], 'clyvora-sample.png', { type: 'image/png' })
}

function resultChangeLabel(item: QueueItem): string | null {
  if (!item.outputBlob) return null
  const change = calculateSizeChange(item.file.size, item.outputBlob.size)
  if (change === null || Math.abs(change) < 0.5) return 'About the same size'
  return change < 0 ? `${Math.abs(change).toFixed(0)}% smaller` : `${change.toFixed(0)}% larger`
}

function App() {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [dropActive, setDropActive] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comparePosition, setComparePosition] = useState(50)
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null)
  const [offline, setOffline] = useState<OfflineReadiness>({ appCached: false, audioCached: false })
  const [offlineRefresh, setOfflineRefresh] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  const preferencesRef = useRef<SavedPreferences>(loadPreferences())
  const abortRef = useRef<AbortController | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const batchCancelledRef = useRef(false)
  const audioEngineRef = useRef<ConversionEngine | null>(null)
  const progressUpdateRef = useRef(new Map<string, { label?: string; progress: number; time: number }>())

  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!busy) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [busy])

  useEffect(() => () => {
    abortRef.current?.abort()
    audioEngineRef.current?.dispose?.()
    itemsRef.current.forEach((item) => item.outputUrl && URL.revokeObjectURL(item.outputUrl))
  }, [])

  const selected = items.find((item) => item.id === selectedId)
    ?? items.find((item) => item.status === 'ready' || item.status === 'failed')
    ?? items[0]
    ?? null
  const completed = items.filter((item) => item.status === 'completed' && item.outputBlob)
  const actionableCount = items.filter((item) => ['ready', 'failed', 'cancelled'].includes(item.status)).length

  useEffect(() => {
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl)
    if (!selected || typeof URL.createObjectURL !== 'function') {
      setSourcePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selected.file)
    setSourcePreviewUrl(url)
    setComparePosition(50)
    return () => URL.revokeObjectURL(url)
    // The previous URL is deliberately revoked whenever the selected source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => {
    let active = true
    const inspectReadiness = async () => {
      let audioCached = false
      if ('caches' in globalThis) {
        const paths = ['/ffmpeg/runtime/single/ffmpeg-core.wasm', '/ffmpeg/runtime/multi/ffmpeg-core.wasm']
        audioCached = Boolean((await Promise.all(paths.map((path) => caches.match(path)))).find(Boolean))
      }
      if (active) setOffline({ appCached: Boolean(navigator.serviceWorker?.controller), audioCached })
    }
    void inspectReadiness()
    navigator.serviceWorker?.ready.then(() => { void inspectReadiness() }).catch(() => undefined)
    return () => { active = false }
  }, [offlineRefresh])

  const applyQueueAction = (action: QueueAction) => {
    itemsRef.current = queueReducer(itemsRef.current, action)
    dispatch(action)
  }

  const patchItem = (id: string, patch: Partial<QueueItem>) => applyQueueAction({ type: 'update', id, patch })

  const rememberOptions = (item: QueueItem, options: ConversionOptions) => {
    preferencesRef.current = {
      ...preferencesRef.current,
      [item.detected.format]: preferenceSubset(options),
    }
    savePreferences(preferencesRef.current)
  }

  const updateOptions = (item: QueueItem, options: ConversionOptions) => {
    patchItem(item.id, { options })
    rememberOptions(item, options)
  }

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    const additions: QueueItem[] = []
    const errors: string[] = []
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    for (const file of files) {
      try {
        const detected = await detectFile(file)
        const dimensions = detected.kind === 'image' ? await readImageDimensions(file) : {}
        const memory = assessMemoryRisk(file.size, detected.kind, deviceMemory)
        additions.push({
          id: makeId(),
          file,
          detected,
          options: mergePreferences(detected.format, preferencesRef.current),
          status: 'ready',
          progress: 0,
          warning: memory.level === 'heavy' ? `${memory.label}: ${memory.detail}` : undefined,
          sourceWidth: dimensions.width,
          sourceHeight: dimensions.height,
        })
      } catch (error) {
        errors.push(error instanceof FileDetectionError ? `${file.name}: ${error.message}` : `${file.name}: Could not inspect this file.`)
      }
    }
    if (additions.length) {
      applyQueueAction({ type: 'add', items: additions })
      setSelectedId((current) => current ?? additions[0].id)
    }
    setNotice(errors.join(' '))
  }, [])

  const addSample = async () => {
    try {
      await addFiles([await createSampleFile()])
    } catch (error) {
      setNotice(friendlyError(error))
    }
  }

  const pasteImage = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error('Clipboard image reading is not available in this browser. You can still paste with Ctrl or Command + V.')
      const clipboardItems = await navigator.clipboard.read()
      const imageType = clipboardItems.flatMap((entry) => entry.types).find((type) => type.startsWith('image/'))
      const source = clipboardItems.find((entry) => imageType && entry.types.includes(imageType))
      if (!source || !imageType) throw new Error('There is no supported image in the clipboard.')
      const extension = imageType === 'image/jpeg' ? 'jpg' : imageType.split('/')[1]
      await addFiles([new File([await source.getType(imageType)], `pasted-image.${extension}`, { type: imageType })])
    } catch (error) {
      setNotice(friendlyError(error))
    }
  }

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((candidate) => candidate.type.startsWith('image/'))
      if (file) void addFiles([file])
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addFiles])

  const reportProgress = (id: string, progress: number | null, label?: string) => {
    const normalized = progress ?? 0
    const now = performance.now()
    const previous = progressUpdateRef.current.get(id)
    const isSmallUpdate = progress !== null && previous && label === previous.label && normalized < 1
      && Math.abs(normalized - previous.progress) < 0.01 && now - previous.time < 100
    if (isSmallUpdate) return
    progressUpdateRef.current.set(id, { label, progress: normalized, time: now })
    patchItem(id, {
      status: label === 'Loading audio engine' ? 'loading-engine' : 'converting',
      progress: normalized,
      phaseLabel: label,
    })
  }

  const removeItem = (item: QueueItem) => {
    if (item.id === activeIdRef.current) return
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    applyQueueAction({ type: 'remove', id: item.id })
    if (selectedId === item.id) setSelectedId(null)
  }

  const runOne = async (id: string, usedNames: Set<string>): Promise<void> => {
    const item = itemsRef.current.find((entry) => entry.id === id)
    if (!item || item.status === 'completed') return

    if (!getOutputFormats(item.detected.format).includes(item.options.outputFormat)) {
      patchItem(id, { status: 'failed', error: 'Choose a compatible output format.' })
      return
    }

    const controller = new AbortController()
    const startedAt = performance.now()
    abortRef.current = controller
    activeIdRef.current = id
    patchItem(id, { status: item.detected.kind === 'audio' ? 'loading-engine' : 'converting', progress: 0, error: undefined, phaseLabel: item.detected.kind === 'audio' ? 'Loading audio engine' : 'Preparing image' })

    try {
      let engine: ConversionEngine
      if (item.detected.kind === 'image') {
        const { ImageConversionEngine } = await import('./engines/image')
        engine = new ImageConversionEngine()
      } else {
        const { AudioConversionEngine } = await import('./engines/audio')
        engine = audioEngineRef.current ?? new AudioConversionEngine()
        audioEngineRef.current = engine
      }
      const blob = await engine.convert(item.file, item.options, controller.signal, (progress, label) => reportProgress(id, progress, label))
      controller.signal.throwIfAborted()
      const preferred = outputFilename(item.file.name, item.options.outputFormat)
      const name = uniqueFilename(preferred, usedNames)
      usedNames.add(name.toLowerCase())
      const url = URL.createObjectURL(blob)
      const dimensions = item.detected.kind === 'image' ? await readImageDimensions(blob) : {}
      patchItem(id, {
        status: 'completed',
        progress: 1,
        outputBlob: blob,
        outputUrl: url,
        outputName: name,
        phaseLabel: 'Complete',
        resultWidth: dimensions.width,
        resultHeight: dimensions.height,
        durationMs: performance.now() - startedAt,
      })
      if (item.detected.kind === 'audio') setOfflineRefresh((value) => value + 1)
    } catch (error) {
      const cancelled = controller.signal.aborted
      patchItem(id, { status: cancelled ? 'cancelled' : 'failed', progress: 0, phaseLabel: cancelled ? 'Cancelled' : 'Needs attention', error: friendlyError(error) })
    } finally {
      progressUpdateRef.current.delete(id)
      activeIdRef.current = null
      abortRef.current = null
    }
  }

  const convertIds = async (ids: string[]) => {
    if (busy || !ids.length) return
    setBusy(true)
    batchCancelledRef.current = false
    const usedNames = new Set(itemsRef.current.flatMap((item) => item.outputName ? [item.outputName.toLowerCase()] : []))
    for (const id of ids) {
      if (batchCancelledRef.current) break
      const current = itemsRef.current.find((item) => item.id === id)
      if (current?.status === 'failed' || current?.status === 'cancelled') patchItem(id, { status: 'ready' })
      await runOne(id, usedNames)
    }
    setBusy(false)
  }

  const cancel = () => {
    batchCancelledRef.current = true
    abortRef.current?.abort()
    audioEngineRef.current?.cancel?.()
    applyQueueAction({ type: 'cancelQueued' })
  }

  const clearCompleted = () => {
    items.filter((item) => item.status === 'completed' || item.status === 'cancelled').forEach((item) => item.outputUrl && URL.revokeObjectURL(item.outputUrl))
    applyQueueAction({ type: 'clearCompleted' })
    setSelectedId(null)
  }

  const applyToAll = () => {
    if (!selected) return
    itemsRef.current.forEach((item) => {
      if (item.id === selected.id || item.detected.kind !== selected.detected.kind || item.status === 'completed') return
      patchItem(item.id, { options: applyCompatibleSettings(selected.options, item.detected.format, item.options) })
    })
    setNotice(`Compatible settings from ${selected.file.name} were applied to the ${selected.detected.kind} queue.`)
  }

  const downloadAll = async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    completed.forEach((item) => zip.file(item.outputName ?? 'converted', item.outputBlob!))
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'clyvora-convert.zip'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const completedSummary = useMemo(() => completed.length === 1 ? '1 file ready' : `${completed.length} files ready`, [completed.length])
  const selectedMemory = selected ? assessMemoryRisk(selected.file.size, selected.detected.kind, (navigator as Navigator & { deviceMemory?: number }).deviceMemory) : null
  const selectedPipeline = selected?.detected.kind === 'image'
    ? 'Native browser image pipeline'
    : globalThis.crossOriginIsolated ? 'Multithreaded local FFmpeg worker' : 'Single-threaded local FFmpeg worker'

  return (
    <main className={items.length ? 'app app--workspace' : 'app'}>
      <div className="ambient" aria-hidden="true"><i /><i /><i /></div>
      <header className="site-header">
        <a href="#top" className="brand" aria-label="Clyvora Convert home">
          <img src="/favicon.png" alt="" width="27" height="27" decoding="async" />
          <span>Clyvora <em>Convert</em></span>
        </a>
        <div className="header-statuses">
          <div className="local-badge"><span /> Local processing only</div>
          <div className="offline-badge" title="Required assets are cached after first use">{offline.appCached ? 'App ready offline' : 'Offline after first visit'}</div>
        </div>
      </header>

      <section id="top" className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Private media conversion</p>
        <h1 id="page-title">Convert files <em>locally.</em></h1>
        <p className="lede">A focused converter with detailed controls and none of the server wait. Everything happens inside this browser.</p>
        <div className="privacy-points" aria-label="Privacy guarantees">
          <span>No file transfer</span><span>No conversion server</span><span>No filename logging</span>
        </div>
      </section>

      <section className="converter-card" aria-label="Local file converter">
        <div className="converter-topbar">
          <div><span className="converter-dot" /> Local converter</div>
          <div className="route-preview" aria-label="Supported conversion examples"><b>PNG</b><span>→</span><b>JPG</b><i /> <b>MP3</b><span>→</span><b>WAV</b></div>
        </div>

        {items.length === 0 ? (
          <>
            <section
              className={`dropzone ${dropActive ? 'dropzone--active' : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setDropActive(true) }}
              onDragOver={(event) => { event.preventDefault(); setDropActive(true) }}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setDropActive(false) }}
              onDrop={(event) => { event.preventDefault(); setDropActive(false); void addFiles(Array.from(event.dataTransfer.files)) }}
              aria-label="Choose media files"
            >
              <input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} aria-label="Choose image or audio files" tabIndex={-1} onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
              <div className="drop-icon" aria-hidden="true"><span>+</span></div>
              <div><h2>Select files to convert</h2><p>Drop multiple files here or choose them from this device.</p></div>
              <button className="button button--primary button--select" type="button" onClick={() => inputRef.current?.click()}>Choose files <span>⌄</span></button>
              <div className="local-note"><span>◆</span> Your files never leave this device.</div>
            </section>
            <div className="starter-actions">
              <button type="button" onClick={() => void addSample()}>Try a sample image</button>
              <span />
              <button type="button" onClick={() => void pasteImage()}>Paste an image</button>
              <span />
              <small>PNG · JPG · WebP · MP3 · WAV</small>
            </div>
          </>
        ) : (
          <section className="workspace" aria-labelledby="queue-heading">
            <div className="workspace-heading">
              <div><p className="eyebrow">Conversion queue</p><h2 id="queue-heading">{items.length} {items.length === 1 ? 'file' : 'files'} in queue</h2></div>
              <button className="button button--add" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>+ Add files</button>
              <input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} aria-label="Add image or audio files" tabIndex={-1} onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
            </div>

            <div className="queue-list" role="list" aria-label="Conversion queue">
              {items.map((item) => (
                <article key={item.id} className={`queue-card ${selected?.id === item.id ? 'queue-card--selected' : ''}`} role="listitem">
                  <div className="queue-row">
                    <button className="queue-file" type="button" onClick={() => setSelectedId(item.id)} aria-label={`Configure ${item.file.name}`}>
                      <span className={`file-glyph file-glyph--${item.detected.kind}`} aria-hidden="true">{item.detected.kind === 'image' ? '▧' : '♪'}</span>
                      <span className="file-copy"><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)}{item.sourceWidth ? ` · ${item.sourceWidth} × ${item.sourceHeight}` : ''}</small></span>
                    </button>
                    <div className="conversion-route" aria-label={`${item.detected.format} to ${item.options.outputFormat}`}>
                      <span className="format-chip">{item.detected.format.toUpperCase()}</span>
                      <span className="route-arrow">→</span>
                      <label className="inline-output"><span className="sr-only">Convert {item.file.name} to</span>
                        <select disabled={busy || item.status === 'completed'} value={item.options.outputFormat} onChange={(event) => updateOptions(item, { ...item.options, outputFormat: event.target.value as MediaFormat })}>
                          {getOutputFormats(item.detected.format).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
                        </select>
                      </label>
                    </div>
                    <button className="settings-trigger" type="button" onClick={() => setSelectedId(item.id)} aria-label={`Open settings for ${item.file.name}`}>Settings</button>
                    <span className={`status status--${item.status}`}>{item.status.replace('-', ' ')}</span>
                    <button className="remove" type="button" disabled={item.id === activeIdRef.current} onClick={() => removeItem(item)} aria-label={`Remove ${item.file.name}`}>×</button>
                  </div>
                  {(item.status === 'converting' || item.status === 'loading-engine') && (
                    <div className={`progress ${item.detected.kind === 'image' || item.status === 'loading-engine' ? 'progress--indeterminate' : ''}`} role="progressbar" aria-label={`${item.phaseLabel ?? 'Converting'} ${item.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.detected.kind === 'audio' && item.status === 'converting' ? Math.round(item.progress * 100) : undefined} aria-valuetext={item.detected.kind === 'audio' && item.status === 'converting' ? `${Math.round(item.progress * 100)} percent` : item.phaseLabel}>
                      <span style={item.detected.kind === 'audio' && item.status === 'converting' ? { width: `${Math.round(item.progress * 100)}%` } : undefined} /><small>{item.phaseLabel}{item.detected.kind === 'audio' && item.status === 'converting' ? ` · ${Math.round(item.progress * 100)}%` : ''}</small>
                    </div>
                  )}
                  {item.warning && <p className="row-message row-message--warn">{item.warning}</p>}
                  {item.error && <p className="row-message" role="alert">{item.error}</p>}
                  {item.status === 'completed' && (
                    <div className="inline-result">
                      <span><strong>{item.outputName}</strong> · {formatBytes(item.outputBlob?.size ?? 0)} · {resultChangeLabel(item)}</span>
                      <a href={item.outputUrl} download={item.outputName}>Download</a>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className="converter-actions">
              <div className="secondary-actions">
                <button type="button" disabled={!items.some((item) => item.status === 'completed' || item.status === 'cancelled')} onClick={clearCompleted}>Clear completed</button>
                {completed.length > 1 && <button type="button" disabled={busy} onClick={() => void downloadAll().catch((error: unknown) => setNotice(friendlyError(error)))}>Download all as ZIP</button>}
              </div>
              {busy ? <button type="button" className="button button--cancel" onClick={cancel}>Cancel conversion</button> : <button type="button" className="button button--convert" disabled={actionableCount === 0} onClick={() => void convertIds(items.filter((item) => item.status !== 'completed').map((item) => item.id))}>Convert {actionableCount || ''} {actionableCount === 1 ? 'file' : 'files'} <span>→</span></button>}
            </div>
          </section>
        )}
      </section>

      {notice && <div className="notice" role="alert"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

      {selected && (
        <section className="detail-panel" aria-labelledby="settings-heading">
          <div className="detail-heading">
            <div><p className="eyebrow">Selected file</p><h2 id="settings-heading">{selected.file.name}</h2></div>
            <button type="button" className="apply-all" disabled={busy || items.filter((item) => item.detected.kind === selected.detected.kind).length < 2} onClick={applyToAll}>Apply settings to compatible files</button>
          </div>
          <div className="detail-grid">
            <div className="preview-panel">
              <div className="preview-topline"><span>{selected.outputUrl ? 'Before / after' : 'Source preview'}</span><span>{selected.sourceWidth ? `${selected.sourceWidth} × ${selected.sourceHeight}` : selected.detected.format.toUpperCase()}</span></div>
              {selected.detected.kind === 'image' && sourcePreviewUrl ? (
                <div className="image-compare">
                  <img src={sourcePreviewUrl} alt={`Source preview of ${selected.file.name}`} />
                  {selected.outputUrl && <div className="result-layer" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}><img src={selected.outputUrl} alt={`Converted preview of ${selected.file.name}`} /></div>}
                  {selected.outputUrl && <div className="compare-line" style={{ left: `${comparePosition}%` }}><span>↔</span></div>}
                </div>
              ) : selected.detected.kind === 'audio' && sourcePreviewUrl ? (
                <div className="audio-preview"><span>Source audio</span><audio controls preload="metadata" src={sourcePreviewUrl} />{selected.outputUrl && <><span>Converted audio</span><audio controls preload="metadata" src={selected.outputUrl} /></>}</div>
              ) : <div className="preview-placeholder">Preview unavailable in this browser.</div>}
              {selected.outputUrl && selected.detected.kind === 'image' && <label className="compare-control">Comparison position<input type="range" min="0" max="100" value={comparePosition} onChange={(event) => setComparePosition(Number(event.target.value))} /></label>}
              <div className="file-assessment">
                <span className={`risk risk--${selectedMemory?.level}`}>{selectedMemory?.label}</span>
                <span>{selectedMemory?.detail}</span>
              </div>
            </div>

            <aside className="settings" aria-label={`Settings for ${selected.file.name}`}>
              <fieldset disabled={busy || selected.status === 'completed'}>
                <label>Output format
                  <select aria-label="Output format" value={selected.options.outputFormat} onChange={(event) => updateOptions(selected, { ...selected.options, outputFormat: event.target.value as MediaFormat })}>
                    {getOutputFormats(selected.detected.format).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
                  </select>
                </label>
                {isImageFormat(selected.detected.format) && (
                  <>
                    {(selected.options.outputFormat === 'jpg' || selected.options.outputFormat === 'webp') && <label>Image quality <span>{Math.round(selected.options.quality * 100)}%</span><input type="range" min="0.1" max="1" step="0.05" value={selected.options.quality} onChange={(event) => updateOptions(selected, { ...selected.options, quality: Number(event.target.value) })} /></label>}
                    <div className="field-group"><span>Resize (optional)</span><div className="dimension-fields">
                      <label>Width<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.width ?? ''} onChange={(event) => updateOptions(selected, { ...selected.options, width: event.target.value ? Number(event.target.value) : undefined })} /></label>
                      <span aria-hidden="true">×</span>
                      <label>Height<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.height ?? ''} onChange={(event) => updateOptions(selected, { ...selected.options, height: event.target.value ? Number(event.target.value) : undefined })} /></label>
                    </div></div>
                    <label className="check"><input type="checkbox" checked={selected.options.lockAspectRatio} onChange={(event) => updateOptions(selected, { ...selected.options, lockAspectRatio: event.target.checked })} /> Lock aspect ratio</label>
                    {selected.options.outputFormat === 'jpg' && <label>Transparent pixels<div className="color-field"><input type="color" value={selected.options.jpgBackgroundColor} onChange={(event) => updateOptions(selected, { ...selected.options, jpgBackgroundColor: event.target.value })} /><span>{selected.options.jpgBackgroundColor}</span></div></label>}
                  </>
                )}
                {selected.detected.kind === 'audio' && selected.options.outputFormat === 'mp3' && <label>MP3 bitrate<select value={selected.options.mp3Bitrate} onChange={(event) => updateOptions(selected, { ...selected.options, mp3Bitrate: Number(event.target.value) as 128 | 192 | 256 | 320 })}>{[128, 192, 256, 320].map((value) => <option key={value} value={value}>{value} kbps</option>)}</select></label>}
                {selected.detected.format === 'mp3' && <p className="hint">WAV will be larger. It cannot restore quality already lost in the MP3.</p>}
                <div className="pipeline-card"><span>Conversion method</span><strong>{selectedPipeline}</strong><small>{selected.detected.kind === 'image' ? 'FFmpeg stays unloaded.' : 'Loaded only for this audio job.'}</small></div>
                {selected.status !== 'completed' && <button className="button button--primary button--full" type="button" onClick={() => void convertIds([selected.id])}>{selected.status === 'failed' || selected.status === 'cancelled' ? 'Retry conversion' : 'Convert file'}</button>}
              </fieldset>
              {selected.status === 'completed' && selected.outputUrl && (
                <div className="result-summary">
                  <span className="result-ready">Result ready</span>
                  <dl>
                    <div><dt>Original</dt><dd>{formatBytes(selected.file.size)}</dd></div>
                    <div><dt>Result</dt><dd>{formatBytes(selected.outputBlob?.size ?? 0)}</dd></div>
                    <div><dt>Change</dt><dd>{resultChangeLabel(selected)}</dd></div>
                    <div><dt>Time</dt><dd>{formatDuration(selected.durationMs)}</dd></div>
                    {selected.resultWidth && <div><dt>Dimensions</dt><dd>{selected.resultWidth} × {selected.resultHeight}</dd></div>}
                  </dl>
                  <a className="button button--primary button--full" href={selected.outputUrl} download={selected.outputName}>Download result</a>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      <section className="readiness-section" aria-labelledby="readiness-heading">
        <div><p className="eyebrow">Offline readiness</p><h2 id="readiness-heading">Works after the tools are cached.</h2></div>
        <div className="readiness-grid">
          <article><span className="ready-dot ready-dot--on" /><div><strong>Images</strong><small>Ready now with browser-native tools</small></div></article>
          <article><span className={`ready-dot ${offline.audioCached ? 'ready-dot--on' : ''}`} /><div><strong>Audio</strong><small>{offline.audioCached ? 'FFmpeg is ready offline' : 'Caches after the first audio conversion'}</small></div></article>
          <article><span className={`ready-dot ${offline.appCached ? 'ready-dot--on' : ''}`} /><div><strong>Application</strong><small>{offline.appCached ? 'Interface cached for offline use' : 'Caches after the first production visit'}</small></div></article>
        </div>
      </section>

      <section className="how-section" aria-labelledby="how-heading">
        <div className="section-heading"><p className="eyebrow">How it works</p><h2 id="how-heading">One direct path. No detour.</h2></div>
        <div className="local-flow" aria-label="Local conversion flow"><span>Your file</span><b>→</b><span>This browser</span><b>→</b><span>Your download</span></div>
        <div className="pipeline-grid">
          <article><span>Images</span><h3>Native browser pipeline</h3><p>Decode, resize and export with browser image tools. Transparency and dimensions stay under your control.</p></article>
          <article><span>Audio</span><h3>Local FFmpeg worker</h3><p>The audio engine loads only when needed and runs away from the interface, using cached same-device assets.</p></article>
        </div>
      </section>

      <section className="formats-section" aria-labelledby="formats-heading">
        <div className="section-heading"><p className="eyebrow">Supported pairs</p><h2 id="formats-heading">Focused by design.</h2><p>Only the conversions shown here are available in version one.</p></div>
        <div className="pair-grid">{[['PNG', 'JPG'], ['PNG', 'WebP'], ['JPG', 'PNG'], ['JPG', 'WebP'], ['WebP', 'PNG'], ['WebP', 'JPG'], ['MP3', 'WAV'], ['WAV', 'MP3']].map(([from, to]) => <div key={`${from}-${to}`}><span>{from}</span><b>→</b><span>{to}</span></div>)}</div>
      </section>

      <section className="privacy-detail" aria-labelledby="privacy-heading">
        <div><p className="eyebrow">Built for privacy</p><h2 id="privacy-heading">Nothing leaves your browser.</h2></div>
        <div className="privacy-list"><p>No backend receives your media. No account connects it to an identity. No analytics records filenames. Object URLs, canvases and a local worker keep the entire conversion on this device.</p><ul><li>No file transfer</li><li>No cloud storage</li><li>No conversion API</li></ul></div>
      </section>

      <footer><span>Clyvora Convert</span><span>Local-first · No tracking · No file transmission</span></footer>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{busy ? items.find((item) => item.status === 'converting' || item.status === 'loading-engine')?.phaseLabel : completedSummary}</div>
    </main>
  )
}

export default App
