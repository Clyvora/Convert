import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { detectFile, FileDetectionError } from './core/detection'
import { formatBytes } from './core/format'
import { assessMemoryRisk, calculateSizeChange, formatDuration } from './core/metrics'
import { outputFilename, uniqueFilename } from './core/naming'
import { applyCompatibleSettings, mergePreferences, preferenceSubset } from './core/preferences'
import type { SavedPreferences } from './core/preferences'
import { getOutputFormats, isAudioFormat, isImageFormat, isVideoFormat } from './core/registry'
import { queueReducer } from './core/queue'
import type { QueueAction } from './core/queue'
import type {
  AudioBitrate,
  AudioChannels,
  AudioSampleRate,
  ConversionEngine,
  ConversionOptions,
  MediaFormat,
  QueueItem,
  VideoCodec,
  VideoQuality,
  VideoResolution,
} from './core/types'

const ACCEPT = [
  '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.ogg', '.opus', '.mp4', '.webm',
  'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm',
].join(',')
const PREFERENCE_KEY = 'clyvora-convert-preferences-v1'
const APP_PREFERENCE_KEY = 'clyvora-convert-app-preferences-v1'

interface AppPreferences {
  rememberSettings: boolean
  autoDownloadSingle: boolean
  reduceMotion: boolean
}

const DEFAULT_APP_PREFERENCES: AppPreferences = {
  rememberSettings: true,
  autoDownloadSingle: false,
  reduceMotion: false,
}

const IMAGE_QUALITY_PRESETS = [
  { label: 'Smaller', value: 0.72 },
  { label: 'Balanced', value: 0.86 },
  { label: 'High', value: 0.96 },
] as const
const AUDIO_BITRATES: AudioBitrate[] = [96, 128, 192, 256, 320]
const VIDEO_RESOLUTIONS: Array<{ label: string; value: VideoResolution }> = [
  { label: 'Original', value: 'original' },
  { label: '1080p', value: 1080 },
  { label: '720p', value: 720 },
  { label: '480p', value: 480 },
]
const VIDEO_QUALITIES: Array<{ label: string; value: VideoQuality }> = [
  { label: 'Smaller', value: 'smaller' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'High', value: 'high' },
]

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Conversion cancelled. You can retry when ready.'
  if (error instanceof Error) return error.message
  return 'Conversion failed. The source may be damaged, unsupported, or too large for this browser.'
}

function loadJson<T>(key: string, fallback: T): T {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') } as T } catch { return fallback }
}

function loadPreferences(): SavedPreferences {
  try { return JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? '{}') as SavedPreferences } catch { return {} }
}

function savePreferences(preferences: SavedPreferences): void {
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Storage is optional. */ }
}

async function readImageDimensions(blob: Blob): Promise<{ width?: number; height?: number }> {
  if (!('createImageBitmap' in globalThis)) return {}
  try {
    const bitmap = await createImageBitmap(blob)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch { return {} }
}

async function readVideoMetadata(blob: Blob): Promise<{ width?: number; height?: number; duration?: number }> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return {}
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    const finish = (value: { width?: number; height?: number; duration?: number }) => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(value)
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

async function createSampleFile(): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 600
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not create the sample image.')
  context.fillStyle = '#090a0a'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = 'rgba(238,234,224,.12)'; context.lineWidth = 1
  for (let x = 0; x <= canvas.width; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke() }
  for (let y = 0; y <= canvas.height; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke() }
  context.strokeStyle = 'rgba(238,234,224,.38)'; context.beginPath(); context.arc(760, 280, 210, 0, Math.PI * 2); context.stroke()
  context.fillStyle = '#eeeae0'; context.font = '300 72px system-ui'; context.fillText('Clyvora Convert', 64, 260)
  context.fillStyle = '#9a9891'; context.font = '24px system-ui'; context.fillText('A locally generated sample image.', 68, 310)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create the sample image.')), 'image/png'))
  canvas.width = 1; canvas.height = 1
  return new File([blob], 'clyvora-sample.png', { type: 'image/png' })
}

function resultChangeLabel(item: QueueItem): string | null {
  if (!item.outputBlob) return null
  const change = calculateSizeChange(item.file.size, item.outputBlob.size)
  if (change === null || Math.abs(change) < 0.5) return 'About the same size'
  return change < 0 ? `${Math.abs(change).toFixed(0)}% smaller` : `${change.toFixed(0)}% larger`
}

function statusLabel(item: QueueItem): string {
  if (item.phaseLabel) return item.phaseLabel
  return { ready: 'Ready', 'loading-engine': 'Loading engine', converting: 'Converting', completed: 'Complete', failed: 'Needs attention', cancelled: 'Cancelled' }[item.status]
}

function formatKind(kind: QueueItem['detected']['kind']): string {
  return kind[0].toUpperCase() + kind.slice(1)
}

function App() {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [dropActive, setDropActive] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [comparePosition, setComparePosition] = useState(50)
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null)
  const [appPreferences, setAppPreferences] = useState<AppPreferences>(() => loadJson(APP_PREFERENCE_KEY, DEFAULT_APP_PREFERENCES))
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  const preferencesRef = useRef<SavedPreferences>(loadPreferences())
  const appPreferencesRef = useRef(appPreferences)
  const abortRef = useRef<AbortController | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const batchCancelledRef = useRef(false)
  const mediaEngineRef = useRef<ConversionEngine | null>(null)
  const progressUpdateRef = useRef(new Map<string, { label?: string; progress: number; time: number }>())
  const previousItemCountRef = useRef(0)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { appPreferencesRef.current = appPreferences }, [appPreferences])
  useEffect(() => {
    try { localStorage.setItem(APP_PREFERENCE_KEY, JSON.stringify(appPreferences)) } catch { /* Optional. */ }
  }, [appPreferences])
  useEffect(() => {
    if (previousItemCountRef.current === 0 && items.length > 0) {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    previousItemCountRef.current = items.length
  }, [items.length])
  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { if (busy) event.preventDefault() }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [busy])
  useEffect(() => () => {
    abortRef.current?.abort()
    mediaEngineRef.current?.dispose?.()
    itemsRef.current.forEach((item) => item.outputUrl && URL.revokeObjectURL(item.outputUrl))
  }, [])

  const selected = items.find((item) => item.id === selectedId) ?? null
  const completed = items.filter((item) => item.status === 'completed' && item.outputBlob)
  const actionableCount = items.filter((item) => ['ready', 'failed', 'cancelled'].includes(item.status)).length

  useEffect(() => {
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl)
    if (!selected || typeof URL.createObjectURL !== 'function') { setSourcePreviewUrl(null); return }
    const url = URL.createObjectURL(selected.file)
    setSourcePreviewUrl(url)
    setComparePosition(50)
    return () => URL.revokeObjectURL(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => {
    if (!optionsOpen && !previewOpen && !preferencesOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOptionsOpen(false); setPreviewOpen(false); setPreferencesOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [optionsOpen, previewOpen, preferencesOpen])

  const applyQueueAction = (action: QueueAction) => {
    itemsRef.current = queueReducer(itemsRef.current, action)
    dispatch(action)
  }
  const patchItem = (id: string, patch: Partial<QueueItem>) => applyQueueAction({ type: 'update', id, patch })
  const rememberOptions = (item: QueueItem, options: ConversionOptions) => {
    if (!appPreferencesRef.current.rememberSettings) return
    preferencesRef.current = { ...preferencesRef.current, [item.detected.format]: preferenceSubset(options) }
    savePreferences(preferencesRef.current)
  }
  const updateOptions = (item: QueueItem, options: ConversionOptions) => { patchItem(item.id, { options }); rememberOptions(item, options) }

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    const additions: QueueItem[] = []
    const errors: string[] = []
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    for (const file of files) {
      try {
        const detected = await detectFile(file)
        const imageDetails = detected.kind === 'image' ? await readImageDimensions(file) : {}
        const videoDetails = detected.kind === 'video' ? await readVideoMetadata(file) : {}
        const memory = assessMemoryRisk(file.size, detected.kind, deviceMemory)
        additions.push({
          id: makeId(), file, detected, options: mergePreferences(detected.format, preferencesRef.current),
          status: 'ready', progress: 0,
          warning: memory.level === 'heavy' ? `${memory.label}: ${memory.detail}` : undefined,
          sourceWidth: imageDetails.width ?? videoDetails.width,
          sourceHeight: imageDetails.height ?? videoDetails.height,
          sourceDurationSeconds: videoDetails.duration,
        })
      } catch (error) {
        errors.push(error instanceof FileDetectionError ? `${file.name}: ${error.message}` : `${file.name}: Could not inspect this file.`)
      }
    }
    if (additions.length) applyQueueAction({ type: 'add', items: additions })
    setNotice(errors.join(' '))
  }, [])

  const addSample = async () => { try { await addFiles([await createSampleFile()]) } catch (error) { setNotice(friendlyError(error)) } }
  const pasteImage = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error('Clipboard image reading is not available in this browser.')
      const clipboardItems = await navigator.clipboard.read()
      const imageType = clipboardItems.flatMap((entry) => entry.types).find((type) => type.startsWith('image/'))
      const source = clipboardItems.find((entry) => imageType && entry.types.includes(imageType))
      if (!source || !imageType) throw new Error('There is no supported image in the clipboard.')
      const extension = imageType === 'image/jpeg' ? 'jpg' : imageType.split('/')[1]
      await addFiles([new File([await source.getType(imageType)], `pasted-image.${extension}`, { type: imageType })])
    } catch (error) { setNotice(friendlyError(error)) }
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
    const small = progress !== null && previous && label === previous.label && normalized < 1 && Math.abs(normalized - previous.progress) < 0.01 && now - previous.time < 100
    if (small) return
    progressUpdateRef.current.set(id, { label, progress: normalized, time: now })
    patchItem(id, { status: label?.startsWith('Loading') ? 'loading-engine' : 'converting', progress: normalized, phaseLabel: label })
  }

  const removeItem = (item: QueueItem) => {
    if (item.id === activeIdRef.current) return
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    applyQueueAction({ type: 'remove', id: item.id })
    if (selectedId === item.id) { setSelectedId(null); setOptionsOpen(false); setPreviewOpen(false) }
  }

  const runOne = async (id: string, usedNames: Set<string>): Promise<{ url: string; name: string } | null> => {
    const item = itemsRef.current.find((entry) => entry.id === id)
    if (!item || item.status === 'completed') return null
    if (!getOutputFormats(item.detected.format).includes(item.options.outputFormat)) {
      patchItem(id, { status: 'failed', error: 'Choose a compatible output format.' }); return null
    }
    const controller = new AbortController()
    const startedAt = performance.now()
    abortRef.current = controller; activeIdRef.current = id
    patchItem(id, { status: item.detected.kind === 'image' ? 'converting' : 'loading-engine', progress: 0, error: undefined, phaseLabel: item.detected.kind === 'image' ? 'Preparing image' : 'Loading local media engine' })
    try {
      let engine: ConversionEngine
      if (item.detected.kind === 'image') {
        const { ImageConversionEngine } = await import('./engines/image')
        engine = new ImageConversionEngine()
      } else {
        const { MediaConversionEngine } = await import('./engines/audio')
        engine = mediaEngineRef.current ?? new MediaConversionEngine()
        mediaEngineRef.current = engine
      }
      const blob = await engine.convert(item.file, item.detected, item.options, controller.signal, (progress, label) => reportProgress(id, progress, label))
      controller.signal.throwIfAborted()
      const preferred = outputFilename(item.file.name, item.options.outputFormat)
      const name = uniqueFilename(preferred, usedNames)
      usedNames.add(name.toLowerCase())
      const url = URL.createObjectURL(blob)
      const imageDetails = isImageFormat(item.options.outputFormat) ? await readImageDimensions(blob) : {}
      const videoDetails = isVideoFormat(item.options.outputFormat) ? await readVideoMetadata(blob) : {}
      patchItem(id, {
        status: 'completed', progress: 1, outputBlob: blob, outputUrl: url, outputName: name,
        phaseLabel: undefined, resultWidth: imageDetails.width ?? videoDetails.width,
        resultHeight: imageDetails.height ?? videoDetails.height, durationMs: performance.now() - startedAt,
      })
      return { url, name }
    } catch (error) {
      const cancelled = controller.signal.aborted
      patchItem(id, { status: cancelled ? 'cancelled' : 'failed', progress: 0, phaseLabel: undefined, error: friendlyError(error) })
      return null
    } finally {
      progressUpdateRef.current.delete(id); activeIdRef.current = null; abortRef.current = null
    }
  }

  const convertIds = async (ids: string[]) => {
    if (busy || !ids.length) return
    setBusy(true); batchCancelledRef.current = false
    const usedNames = new Set(itemsRef.current.flatMap((item) => item.outputName ? [item.outputName.toLowerCase()] : []))
    const results: Array<{ url: string; name: string }> = []
    for (const id of ids) {
      if (batchCancelledRef.current) break
      const current = itemsRef.current.find((item) => item.id === id)
      if (current?.status === 'failed' || current?.status === 'cancelled') patchItem(id, { status: 'ready' })
      const result = await runOne(id, usedNames)
      if (result) results.push(result)
    }
    setBusy(false)
    if (ids.length === 1 && results.length === 1 && appPreferencesRef.current.autoDownloadSingle) {
      const anchor = document.createElement('a'); anchor.href = results[0].url; anchor.download = results[0].name; anchor.click()
    }
  }

  const cancel = () => {
    batchCancelledRef.current = true; abortRef.current?.abort(); mediaEngineRef.current?.cancel?.(); applyQueueAction({ type: 'cancelQueued' })
  }
  const clearCompleted = () => {
    items.filter((item) => item.status === 'completed' || item.status === 'cancelled').forEach((item) => item.outputUrl && URL.revokeObjectURL(item.outputUrl))
    applyQueueAction({ type: 'clearCompleted' }); setSelectedId(null); setOptionsOpen(false); setPreviewOpen(false)
  }
  const openOptions = (item: QueueItem) => { setSelectedId(item.id); setPreviewOpen(false); setOptionsOpen(true) }
  const openPreview = (item: QueueItem) => { setSelectedId(item.id); setOptionsOpen(false); setPreviewOpen(true) }
  const applyToAll = () => {
    if (!selected) return
    let count = 0
    itemsRef.current.forEach((item) => {
      if (item.id === selected.id || item.detected.kind !== selected.detected.kind || item.status === 'completed') return
      patchItem(item.id, { options: applyCompatibleSettings(selected.options, item.detected.format, item.options) }); count += 1
    })
    setNotice(count ? `Applied these settings to ${count} compatible ${formatKind(selected.detected.kind).toLowerCase()} ${count === 1 ? 'file' : 'files'}.` : 'There are no other compatible files to update.')
  }
  const editCompleted = (item: QueueItem) => {
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    patchItem(item.id, { status: 'ready', progress: 0, outputBlob: undefined, outputUrl: undefined, outputName: undefined, resultWidth: undefined, resultHeight: undefined, durationMs: undefined })
    setSelectedId(item.id); setOptionsOpen(true); setPreviewOpen(false)
  }
  const downloadAll = async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    completed.forEach((item) => zip.file(item.outputName ?? 'converted', item.outputBlob!))
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'clyvora-convert.zip'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const updateAppPreferences = (patch: Partial<AppPreferences>) => setAppPreferences((current) => ({ ...current, ...patch }))
  const clearLocalSettings = async () => {
    localStorage.removeItem(PREFERENCE_KEY); localStorage.removeItem(APP_PREFERENCE_KEY)
    preferencesRef.current = {}; setAppPreferences(DEFAULT_APP_PREFERENCES)
    mediaEngineRef.current?.dispose?.(); mediaEngineRef.current = null
    if ('caches' in globalThis) await Promise.all((await caches.keys()).filter((key) => key.startsWith('clyvora-convert')).map((key) => caches.delete(key)))
    setNotice('Saved defaults and cached conversion assets were cleared.')
  }

  const completedSummary = useMemo(() => completed.length === 1 ? '1 file ready' : `${completed.length} files ready`, [completed.length])
  const selectedMemory = selected ? assessMemoryRisk(selected.file.size, selected.detected.kind, (navigator as Navigator & { deviceMemory?: number }).deviceMemory) : null
  const compatibleCount = selected ? items.filter((item) => item.id !== selected.id && item.detected.kind === selected.detected.kind && item.status !== 'completed').length : 0
  const selectedOutputIsAudio = selected ? isAudioFormat(selected.options.outputFormat) : false
  const selectedOutputIsVideo = selected ? isVideoFormat(selected.options.outputFormat) : false

  return (
    <main className={items.length ? 'app app--workspace' : 'app'} data-reduce-motion={appPreferences.reduceMotion || undefined}>
      <div className="ambient" aria-hidden="true"><i /><i /></div>
      <header className="site-header">
        <a href="#top" className="brand" aria-label="Clyvora Convert home"><img src="/favicon.png" alt="" width="32" height="32" /><span>Clyvora <strong>Convert</strong></span></a>
        <nav className="site-nav" aria-label="Application links">
          <button type="button" onClick={() => setPreferencesOpen(true)}>Settings</button>
          <a href="https://github.com/ClyvoraTech/Clyvora/tree/main/Convert" target="_blank" rel="noreferrer">Source</a>
        </nav>
      </header>

      {items.length === 0 ? (
        <div className="landing" id="top">
          <section className="landing-hero" aria-labelledby="page-title">
            <div className="hero-copy"><p className="eyebrow">Private by design</p><h1 id="page-title">Convert media without uploading it.</h1><p>Images, audio, and video are processed directly on this device. No account, analytics, or conversion server.</p></div>
            <div className="route-visual" aria-label="Automatic input detection and output selection">
              <div><span>Input</span><strong>Auto</strong><small>Detected locally</small></div><i>→</i><div className="route-visual__output"><span>Output</span><strong>Choose</strong><small>Per file</small></div>
            </div>
          </section>
          <section className={`drop-card ${dropActive ? 'drop-card--active' : ''}`} aria-label="Choose local media files" onDragEnter={(event) => { event.preventDefault(); setDropActive(true) }} onDragOver={(event) => { event.preventDefault(); setDropActive(true) }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDropActive(false) }} onDrop={(event) => { event.preventDefault(); setDropActive(false); void addFiles(Array.from(event.dataTransfer.files)) }}>
            <input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} aria-label="Choose image, audio, or video files" tabIndex={-1} onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
            <div className="drop-icon" aria-hidden="true">↑</div>
            <div><h2>Select files to convert</h2><p>or drop multiple files here</p></div>
            <button className="button button--primary button--select" type="button" onClick={() => inputRef.current?.click()}>Choose files <span>⌄</span></button>
            <div className="local-note"><span>◆</span> File contents and names stay on this device.</div>
          </section>
          <div className="starter-actions"><button type="button" onClick={() => void addSample()}>Try a sample image</button><span /><button type="button" onClick={() => void pasteImage()}>Paste an image</button></div>
          <section className="capability-strip" id="privacy" aria-label="Supported formats and privacy">
            <div><span>Images</span><strong>PNG · JPG · WebP</strong></div><div><span>Audio</span><strong>MP3 · WAV · OGG · Opus</strong></div><div><span>Video</span><strong>MP4 · WebM</strong></div><div className="capability-strip__privacy"><span>Local processing</span><strong>No upload path</strong></div>
          </section>
          <p className="engine-note">Audio and video use a local FFmpeg engine downloaded on first use (about 32 MB). Source metadata is removed from converted files.</p>
        </div>
      ) : (
        <section className="queue-shell" aria-labelledby="queue-heading">
          <div className="queue-heading"><div><p className="eyebrow">Conversion queue</p><h1 id="queue-heading">{items.length} {items.length === 1 ? 'file' : 'files'} in queue</h1></div><button className="button button--add" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>+ Add files</button><input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} aria-label="Add image, audio, or video files" tabIndex={-1} onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} /></div>
          <div className="queue-list" role="list" aria-label="Conversion queue">
            {items.map((item) => (
              <article key={item.id} className={`queue-card queue-card--${item.detected.kind}`} role="listitem">
                <div className="queue-row">
                  <div className="queue-file"><span className="file-glyph" aria-hidden="true">{item.detected.kind === 'image' ? '▧' : item.detected.kind === 'audio' ? '♪' : '▶'}</span><span className="file-copy"><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)} · {formatKind(item.detected.kind)}{item.sourceWidth ? ` · ${item.sourceWidth} × ${item.sourceHeight}` : ''}</small></span></div>
                  <div className="conversion-route" aria-label={`${item.detected.format} to ${item.options.outputFormat}`}><span className="format-chip">{item.detected.format.toUpperCase()}</span><span className="route-arrow">→</span><label><span className="sr-only">Output format for {item.file.name}</span><select aria-label={`Output format for ${item.file.name}`} disabled={busy || item.status === 'completed'} value={item.options.outputFormat} onChange={(event) => updateOptions(item, { ...item.options, outputFormat: event.target.value as MediaFormat, videoCodec: 'auto' })}>{getOutputFormats(item.detected.format).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}</select></label></div>
                  <div className="row-actions"><button type="button" onClick={() => openPreview(item)}>Preview</button>{item.status === 'completed' ? <button type="button" onClick={() => editCompleted(item)}>Edit</button> : <button type="button" disabled={busy} onClick={() => openOptions(item)}>Options</button>}<button className="remove" type="button" disabled={item.id === activeIdRef.current} onClick={() => removeItem(item)} aria-label={`Remove ${item.file.name}`}>×</button></div>
                  <span className={`status status--${item.status}`}>{statusLabel(item)}</span>
                </div>
                {(item.status === 'converting' || item.status === 'loading-engine') && <div className={`progress ${item.status === 'loading-engine' || item.detected.kind === 'image' ? 'progress--indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.status === 'converting' && item.detected.kind !== 'image' ? Math.round(item.progress * 100) : undefined}><span style={item.status === 'converting' && item.detected.kind !== 'image' ? { width: `${Math.round(item.progress * 100)}%` } : undefined} /><small>{statusLabel(item)}{item.status === 'converting' && item.detected.kind !== 'image' ? ` · ${Math.round(item.progress * 100)}%` : ''}</small></div>}
                {item.warning && <p className="row-message row-message--warn">{item.warning}</p>}
                {item.error && <p className="row-message" role="alert">{item.error}</p>}
                {item.status === 'completed' && <div className="inline-result"><span><strong>{item.outputName}</strong><small>{formatBytes(item.outputBlob?.size ?? 0)} · {resultChangeLabel(item)} · {formatDuration(item.durationMs)}</small></span><a href={item.outputUrl} download={item.outputName}>Download</a></div>}
              </article>
            ))}
          </div>
          <div className="queue-footer"><div><strong>{actionableCount ? `${actionableCount} ${actionableCount === 1 ? 'file' : 'files'} ready to convert` : 'All files converted'}</strong><span>{completed.length ? `${completed.length} completed` : 'Everything stays on this device'}</span></div><div className="queue-footer__actions"><button type="button" className="text-action" disabled={!items.some((item) => item.status === 'completed' || item.status === 'cancelled')} onClick={clearCompleted}>Clear finished</button>{completed.length > 1 && <button type="button" className="button" disabled={busy} onClick={() => void downloadAll().catch((error: unknown) => setNotice(friendlyError(error)))}>Download ZIP</button>}{busy ? <button type="button" className="button button--cancel" onClick={cancel}>Cancel</button> : actionableCount > 0 && <button type="button" className="button button--convert" onClick={() => void convertIds(items.filter((item) => item.status !== 'completed').map((item) => item.id))}>Convert {actionableCount > 1 ? actionableCount : ''}<span>→</span></button>}</div></div>
        </section>
      )}

      {notice && <div className="notice" role="alert"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

      {selected && optionsOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOptionsOpen(false) }}>
          <section className="options-dialog" role="dialog" aria-modal="true" aria-labelledby="options-heading">
            <header><div><p className="eyebrow">{formatKind(selected.detected.kind)} options</p><h2 id="options-heading">{selected.file.name}</h2></div><button type="button" className="modal-close" onClick={() => setOptionsOpen(false)} aria-label="Close options">×</button></header>
            <div className="dialog-route"><span>{selected.detected.format.toUpperCase()}</span><i>→</i><strong>{selected.options.outputFormat.toUpperCase()}</strong></div>
            <div className="options-body">
              {isImageFormat(selected.detected.format) && <>
                {(selected.options.outputFormat === 'jpg' || selected.options.outputFormat === 'webp') && <OptionGroup title="Image quality" help="Lower quality creates smaller files. Balanced is recommended for most images."><Segmented>{IMAGE_QUALITY_PRESETS.map((preset) => <button key={preset.label} type="button" aria-pressed={Math.abs(selected.options.quality - preset.value) < .02} onClick={() => updateOptions(selected, { ...selected.options, quality: preset.value })}>{preset.label}</button>)}</Segmented><label className="range-row">Exact quality <span>{Math.round(selected.options.quality * 100)}%</span><input aria-label="Exact image quality" type="range" min=".1" max="1" step=".01" value={selected.options.quality} onChange={(event) => updateOptions(selected, { ...selected.options, quality: Number(event.target.value) })} /></label></OptionGroup>}
                <details className="advanced-settings"><summary>Dimensions and transparency</summary><div className="advanced-content"><div className="dimension-fields"><label>Width<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.width ?? ''} onChange={(event) => updateOptions(selected, { ...selected.options, width: event.target.value ? Number(event.target.value) : undefined })} /></label><span>×</span><label>Height<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.height ?? ''} onChange={(event) => updateOptions(selected, { ...selected.options, height: event.target.value ? Number(event.target.value) : undefined })} /></label></div><label className="check"><input type="checkbox" checked={selected.options.lockAspectRatio} onChange={(event) => updateOptions(selected, { ...selected.options, lockAspectRatio: event.target.checked })} /> Lock aspect ratio</label><label className="check"><input type="checkbox" checked={selected.options.preventUpscale} onChange={(event) => updateOptions(selected, { ...selected.options, preventUpscale: event.target.checked })} /> Never enlarge smaller images</label>{selected.options.outputFormat === 'jpg' && <label className="color-row">Transparent pixels <span><input type="color" value={selected.options.jpgBackgroundColor} onChange={(event) => updateOptions(selected, { ...selected.options, jpgBackgroundColor: event.target.value })} />{selected.options.jpgBackgroundColor}</span></label>}</div></details>
              </>}

              {selectedOutputIsVideo && <>
                <OptionGroup title="Video quality" help="The selected resolution is a maximum. Smaller videos are never enlarged."><Segmented>{VIDEO_QUALITIES.map((preset) => <button key={preset.value} type="button" aria-pressed={selected.options.videoQuality === preset.value} onClick={() => updateOptions(selected, { ...selected.options, videoQuality: preset.value })}>{preset.label}</button>)}</Segmented></OptionGroup>
                <OptionGroup title="Maximum resolution" help="If this resolution is unavailable, the original dimensions are preserved within the selected limit."><Segmented>{VIDEO_RESOLUTIONS.map((preset) => <button key={preset.label} type="button" aria-pressed={selected.options.videoResolution === preset.value} onClick={() => updateOptions(selected, { ...selected.options, videoResolution: preset.value })}>{preset.label}</button>)}</Segmented></OptionGroup>
                <OptionGroup title="Video codec" help={selected.options.outputFormat === 'mp4' ? 'H.264 offers the broadest playback compatibility.' : 'VP9 provides efficient WebM video in modern browsers.'}><Segmented><button type="button" aria-pressed={selected.options.videoCodec === 'auto'} onClick={() => updateOptions(selected, { ...selected.options, videoCodec: 'auto' })}>Auto</button><button type="button" aria-pressed={selected.options.videoCodec !== 'auto'} onClick={() => updateOptions(selected, { ...selected.options, videoCodec: (selected.options.outputFormat === 'mp4' ? 'h264' : 'vp9') as VideoCodec })}>{selected.options.outputFormat === 'mp4' ? 'H.264 + AAC' : 'VP9 + Opus'}</button></Segmented></OptionGroup>
              </>}

              {(selected.detected.kind === 'audio' || selectedOutputIsAudio || selectedOutputIsVideo) && <>
                <OptionGroup title={selectedOutputIsVideo ? 'Audio bitrate' : 'Audio quality'} help={selected.options.outputFormat === 'wav' ? 'WAV is uncompressed, so bitrate does not apply.' : 'Higher bitrates improve fidelity but increase file size.'}><Segmented>{AUDIO_BITRATES.map((value) => <button key={value} type="button" disabled={selected.options.outputFormat === 'wav'} aria-pressed={selected.options.audioBitrate === value} onClick={() => updateOptions(selected, { ...selected.options, audioBitrate: value })}>{value}k</button>)}</Segmented></OptionGroup>
                {selectedOutputIsAudio && <div className="two-column-options"><OptionGroup title="Channels"><Segmented><button type="button" aria-pressed={selected.options.audioChannels === 'source'} onClick={() => updateOptions(selected, { ...selected.options, audioChannels: 'source' })}>Source</button><button type="button" aria-pressed={selected.options.audioChannels === 1} onClick={() => updateOptions(selected, { ...selected.options, audioChannels: 1 as AudioChannels })}>Mono</button><button type="button" aria-pressed={selected.options.audioChannels === 2} onClick={() => updateOptions(selected, { ...selected.options, audioChannels: 2 as AudioChannels })}>Stereo</button></Segmented></OptionGroup><OptionGroup title="Sample rate"><select aria-label="Audio sample rate" value={selected.options.audioSampleRate} onChange={(event) => updateOptions(selected, { ...selected.options, audioSampleRate: (event.target.value === 'source' ? 'source' : Number(event.target.value)) as AudioSampleRate })}><option value="source">Source</option><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select></OptionGroup></div>}
              </>}
              <div className="privacy-option"><span>Metadata</span><div><strong>Removed automatically</strong><small>Converted files do not retain source metadata.</small></div></div>
              {selectedMemory?.level !== 'light' && <p className="memory-warning">{selectedMemory?.label}: {selectedMemory?.detail}</p>}
            </div>
            <footer><button type="button" className="apply-compatible" disabled={!compatibleCount} onClick={applyToAll}>Apply to {compatibleCount || 'other'} compatible {selected.detected.kind} {compatibleCount === 1 ? 'file' : 'files'}</button><button type="button" className="button button--primary" onClick={() => setOptionsOpen(false)}>Done</button></footer>
          </section>
        </div>
      )}

      {selected && previewOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setPreviewOpen(false) }}>
          <section className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-heading"><header><div><p className="eyebrow">{selected.outputUrl ? 'Before and after' : 'Source preview'}</p><h2 id="preview-heading">{selected.file.name}</h2></div><button type="button" className="modal-close" onClick={() => setPreviewOpen(false)} aria-label="Close preview">×</button></header><div className="preview-body">
            {selected.detected.kind === 'image' && sourcePreviewUrl ? <><div className="image-compare"><img src={sourcePreviewUrl} alt={`Source preview of ${selected.file.name}`} />{selected.outputUrl && <div className="result-layer" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}><img src={selected.outputUrl} alt={`Converted preview of ${selected.file.name}`} /></div>}{selected.outputUrl && <div className="compare-line" style={{ left: `${comparePosition}%` }}><span>↔</span></div>}</div>{selected.outputUrl && <label className="compare-control">Comparison position<input type="range" min="0" max="100" value={comparePosition} onChange={(event) => setComparePosition(Number(event.target.value))} /></label>}</> : selected.detected.kind === 'video' && sourcePreviewUrl ? <div className="media-preview"><label>Source</label><video controls preload="metadata" src={sourcePreviewUrl} />{selected.outputUrl && <><label>Result</label>{isVideoFormat(selected.options.outputFormat) ? <video controls preload="metadata" src={selected.outputUrl} /> : <audio controls preload="metadata" src={selected.outputUrl} />}</>}</div> : sourcePreviewUrl ? <div className="media-preview"><label>Source</label><audio controls preload="metadata" src={sourcePreviewUrl} />{selected.outputUrl && <><label>Result</label><audio controls preload="metadata" src={selected.outputUrl} /></>}</div> : <div className="preview-placeholder">Preview unavailable in this browser.</div>}
          </div>{selected.outputBlob && <footer className="preview-result"><div><span>Result</span><strong>{formatBytes(selected.outputBlob.size)}</strong><small>{resultChangeLabel(selected)} · {formatDuration(selected.durationMs)}</small></div><a className="button button--primary" href={selected.outputUrl} download={selected.outputName}>Download result</a></footer>}</section>
        </div>
      )}

      {preferencesOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setPreferencesOpen(false) }}>
          <section className="preferences-dialog" role="dialog" aria-modal="true" aria-labelledby="preferences-heading"><header><div><p className="eyebrow">Application</p><h2 id="preferences-heading">Settings</h2></div><button type="button" className="modal-close" onClick={() => setPreferencesOpen(false)} aria-label="Close settings">×</button></header><div className="preferences-body"><PreferenceToggle title="Remember conversion settings" description="Use your last format and quality choices for similar files." checked={appPreferences.rememberSettings} onChange={(checked) => updateAppPreferences({ rememberSettings: checked })} /><PreferenceToggle title="Auto-download single results" description="Download automatically when converting one file at a time." checked={appPreferences.autoDownloadSingle} onChange={(checked) => updateAppPreferences({ autoDownloadSingle: checked })} /><PreferenceToggle title="Reduce motion" description="Disable decorative and progress animations in this app." checked={appPreferences.reduceMotion} onChange={(checked) => updateAppPreferences({ reduceMotion: checked })} /><div className="processing-summary"><span>Local processing</span><strong>{globalThis.crossOriginIsolated ? 'Automatic · multithreaded when available' : 'Automatic · compatibility mode'}</strong><small>The faster worker is selected only when this browser safely supports it.</small></div><button type="button" className="danger-action" onClick={() => void clearLocalSettings()}>Clear saved settings and cached engine</button></div></section>
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">{busy ? items.find((item) => item.status === 'converting' || item.status === 'loading-engine')?.phaseLabel : completedSummary}</div>
    </main>
  )
}

function Segmented({ children }: { children: ReactNode }) {
  return <div className="segmented" role="group">{children}</div>
}

function OptionGroup({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return <section className="option-group"><h3>{title}</h3>{children}{help && <p>{help}</p>}</section>
}

function PreferenceToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="preference-toggle"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}

export default App
