import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { detectFile, FileDetectionError } from './core/detection'
import { resetOfflineApplication } from './core/cache'
import { formatBytes } from './core/format'
import { importMediaLink } from './core/linkImport'
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
  VideoQuality,
  VideoResolution,
} from './core/types'

const ACCEPT = [
  '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.ogg', '.opus', '.mp4', '.webm',
  'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm',
].join(',')
const PREFERENCE_KEY = 'clyvora-convert-preferences-v1'

type LinkImportState =
  | { status: 'idle' }
  | { status: 'loading'; loaded: number; total?: number }
  | { status: 'error'; message: string }

interface Notice {
  message: string
  tone: 'success' | 'error' | 'info'
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
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Clipboard access was blocked. Allow clipboard access for this site, or press Ctrl+V to paste an image.'
  if (error instanceof Error) return error.message
  return 'Conversion failed. The source may be damaged, unsupported, or too large for this browser.'
}

function loadPreferences(): SavedPreferences {
  try { return JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? '{}') as SavedPreferences } catch { return {} }
}

function savePreferences(preferences: SavedPreferences): void {
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Storage is optional. */ }
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

type IconName = 'upload' | 'link' | 'plus' | 'image' | 'audio' | 'video' | 'preview' | 'options' | 'remove' | 'arrow' | 'download' | 'archive' | 'cancel'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    upload: <><path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 20h14" /></>,
    link: <><path d="M10.5 13.5 13.5 10" /><path d="M8.2 15.8 6.7 17.3a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" transform="translate(3)" /><path d="m15.8 8.2 1.5-1.5a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" transform="translate(-3)" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="9" r="1.5" /><path d="m5 18 4.5-4.5 3 3 2-2L19 19" /></>,
    audio: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="3" /><path d="m17 10 4-2v8l-4-2" /></>,
    preview: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    options: <><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></>,
    remove: <><path d="M5 5l14 14" /><path d="M19 5 5 19" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    archive: <><path d="M4 7h16" /><path d="M6 7v13h12V7" /><path d="M3 3h18v4H3z" /><path d="M10 12h4" /></>,
    cancel: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6" /><path d="m15 9-6 6" /></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function App() {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [dropActive, setDropActive] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkState, setLinkState] = useState<LinkImportState>({ status: 'idle' })
  const [comparePosition, setComparePosition] = useState(50)
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null)
  const [reduceMotion, setReduceMotion] = useState(() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  const preferencesRef = useRef<SavedPreferences>(loadPreferences())
  const abortRef = useRef<AbortController | null>(null)
  const linkAbortRef = useRef<AbortController | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const batchCancelledRef = useRef(false)
  const mediaEngineRef = useRef<ConversionEngine | null>(null)
  const progressUpdateRef = useRef(new Map<string, { label?: string; progress: number; time: number }>())
  const previousItemCountRef = useRef(0)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const update = () => setReduceMotion(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  useEffect(() => {
    if (previousItemCountRef.current === 0 && items.length > 0) {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    previousItemCountRef.current = items.length
  }, [items.length])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { if (busy) event.preventDefault() }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [busy])
  useEffect(() => () => {
    abortRef.current?.abort()
    linkAbortRef.current?.abort()
    mediaEngineRef.current?.dispose?.()
    itemsRef.current.forEach((item) => item.outputUrl && URL.revokeObjectURL(item.outputUrl))
  }, [])

  const selected = items.find((item) => item.id === selectedId) ?? null
  const completed = items.filter((item) => item.status === 'completed' && item.outputBlob)
  const actionableCount = items.filter((item) => ['ready', 'failed', 'cancelled'].includes(item.status)).length
  const hasOpenDialog = optionsOpen || previewOpen || linkOpen

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
    if (!hasOpenDialog) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter((element) => {
      const style = getComputedStyle(element)
      return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden'
    })
    requestAnimationFrame(() => focusables()[0]?.focus())
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOptionsOpen(false); setPreviewOpen(false); setLinkOpen(false); linkAbortRef.current?.abort()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusables()
      if (!elements.length) { event.preventDefault(); return }
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleDialogKeys)
    return () => {
      window.removeEventListener('keydown', handleDialogKeys)
      document.body.style.overflow = previousBodyOverflow
      requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }, [hasOpenDialog])

  const applyQueueAction = (action: QueueAction) => {
    itemsRef.current = queueReducer(itemsRef.current, action)
    dispatch(action)
  }
  const patchItem = (id: string, patch: Partial<QueueItem>) => applyQueueAction({ type: 'update', id, patch })
  const rememberOptions = (item: QueueItem, options: ConversionOptions) => {
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
    setNotice(errors.length ? { message: errors.join(' '), tone: 'error' } : null)
  }, [])

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((candidate) => candidate.type.startsWith('image/'))
      if (file) void addFiles([file])
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addFiles])

  const openLinkDialog = () => {
    setLinkUrl('')
    setLinkState({ status: 'idle' })
    setOptionsOpen(false); setPreviewOpen(false); setLinkOpen(true)
  }
  const closeLinkDialog = () => {
    linkAbortRef.current?.abort()
    linkAbortRef.current = null
    setLinkOpen(false)
  }
  const submitLink = async () => {
    linkAbortRef.current?.abort()
    const controller = new AbortController()
    linkAbortRef.current = controller
    setLinkState({ status: 'loading', loaded: 0 })
    try {
      const result = await importMediaLink(linkUrl, controller.signal, ({ loaded, total }) => setLinkState({ status: 'loading', loaded, total }))
      await addFiles([result.file])
      setNotice({ message: `${result.file.name} is ready to convert.`, tone: 'success' })
      setLinkOpen(false)
    } catch (error) {
      if (controller.signal.aborted) return
      setLinkState({ status: 'error', message: friendlyError(error) })
    } finally {
      if (linkAbortRef.current === controller) linkAbortRef.current = null
    }
  }

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
      if (result) {
        results.push(result)
        triggerDownload(result.url, result.name)
      }
    }
    setBusy(false)
    if (results.length) {
      setNotice({
        message: results.length === 1
          ? `Converted and downloaded ${results[0].name}.`
          : `Converted and downloaded ${results.length} files. Your browser may ask to allow multiple downloads.`,
        tone: 'success',
      })
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
    setNotice({ message: count ? `Applied these settings to ${count} compatible ${formatKind(selected.detected.kind).toLowerCase()} ${count === 1 ? 'file' : 'files'}.` : 'There are no other compatible files to update.', tone: 'info' })
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
    triggerDownload(url, 'clyvora-convert.zip')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const returnHome = () => {
    if (busy) return
    itemsRef.current.forEach((item) => item.outputUrl && URL.revokeObjectURL(item.outputUrl))
    applyQueueAction({ type: 'reset' })
    setSelectedId(null); setOptionsOpen(false); setPreviewOpen(false); setLinkOpen(false); linkAbortRef.current?.abort(); setNotice(null)
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const queueAnnouncement = useMemo(() => {
    if (!items.length) return 'No files in the conversion queue.'
    if (actionableCount) return `${actionableCount} ${actionableCount === 1 ? 'file is' : 'files are'} ready to convert.`
    if (completed.length) return `${completed.length} ${completed.length === 1 ? 'file was' : 'files were'} converted.`
    return 'No files are ready to convert.'
  }, [actionableCount, completed.length, items.length])
  const selectedMemory = selected ? assessMemoryRisk(selected.file.size, selected.detected.kind, (navigator as Navigator & { deviceMemory?: number }).deviceMemory) : null
  const compatibleCount = selected ? items.filter((item) => item.id !== selected.id && item.detected.kind === selected.detected.kind && item.status !== 'completed').length : 0
  const selectedOutputIsAudio = selected ? isAudioFormat(selected.options.outputFormat) : false
  const selectedOutputIsVideo = selected ? isVideoFormat(selected.options.outputFormat) : false

  return (
    <main className={items.length ? 'app app--workspace' : 'app'} data-reduce-motion={reduceMotion || undefined}>
      <div className="ambient" aria-hidden="true"><i /><i /></div>
      <div ref={backgroundRef} inert={hasOpenDialog ? true : undefined} aria-hidden={hasOpenDialog || undefined}>
      <header className="site-header">
        <button type="button" className="brand" aria-label="Clyvora Convert home" disabled={busy} onClick={returnHome}><img src="/favicon.png" alt="" width="32" height="32" /><span>Clyvora <strong>Convert</strong></span><small>Beta</small></button>
        <nav className="site-nav" aria-label="Clyvora sites">
          <a href="https://www.clyvora.tech/about/">About Clyvora</a>
          <a href="https://www.lens.clyvora.tech/">Clyvora Lens</a>
          <a href="https://github.com/Clyvora/Convert" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </header>

      {items.length === 0 ? (
        <div className="landing" id="top">
          <section className="landing-hero" aria-labelledby="page-title">
            <div className="hero-copy"><h1 id="page-title">Convert media without uploading it.</h1><p>Images, audio, and video are processed directly on this device. No account, upload, or conversion server.</p></div>
          </section>
          <section className={`drop-card ${dropActive ? 'drop-card--active' : ''}`} aria-label="Choose local media files" onDragEnter={(event) => { event.preventDefault(); setDropActive(true) }} onDragOver={(event) => { event.preventDefault(); setDropActive(true) }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDropActive(false) }} onDrop={(event) => { event.preventDefault(); setDropActive(false); void addFiles(Array.from(event.dataTransfer.files)) }}>
            <input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} aria-label="Choose image, audio, or video files" tabIndex={-1} onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
            <div className="drop-icon" aria-hidden="true"><Icon name="upload" /></div>
            <div><h2>Select files to convert</h2><p>or drop multiple files here</p></div>
            <div className="file-source-actions"><button className="button button--primary button--select" type="button" onClick={() => inputRef.current?.click()}><Icon name="upload" />Choose files</button><button className="button button--link" type="button" onClick={openLinkDialog}><Icon name="link" />Paste link</button></div>
            <div className="local-note"><span>◆</span> File contents and names stay on this device.</div>
          </section>
          <section className="product-details" aria-labelledby="convert-details-title">
            <div className="product-details-intro">
              <p className="eyebrow">Private media tools</p>
              <h2 id="convert-details-title">One local converter for images, audio, and video.</h2>
              <p>Clyvora Convert combines batch conversion, format-specific controls, previews, and offline support while keeping selected file contents inside the browser.</p>
            </div>
            <div className="product-details-grid">
              <article>
                <h3>Image converter</h3>
                <p>Convert PNG, JPG, and WebP files with resize, quality, aspect-ratio, no-upscale, and transparency controls.</p>
              </article>
              <article>
                <h3>Audio converter</h3>
                <p>Convert MP3, WAV, OGG, and Opus files with bitrate, channel, and sample-rate options.</p>
              </article>
              <article>
                <h3>Video converter</h3>
                <p>Convert MP4 and WebM video, extract audio, and control output quality, maximum resolution, codec, and audio bitrate.</p>
              </article>
            </div>
            <p className="product-formats"><strong>Supported formats:</strong> PNG, JPG/JPEG, WebP, MP3, WAV, OGG, Opus, MP4, and WebM.</p>
            <div className="product-faq" aria-labelledby="convert-faq-title">
              <h3 id="convert-faq-title">Questions about Clyvora Convert</h3>
              <details>
                <summary>Are selected media files uploaded?</summary>
                <p>No. Local files are converted on your device. Direct-link imports contact the original media host; optional SoundCloud resolution sends the pasted URL to the configured resolver, not the media bytes.</p>
              </details>
              <details>
                <summary>Can the converter work offline?</summary>
                <p>Yes, after the interface and required conversion assets have been loaded and cached once. <button type="button" className="inline-action" onClick={() => void resetOfflineApplication(caches).then((count) => setNotice({ message: count ? 'Offline files cleared. Reload to install a fresh copy.' : 'No Clyvora offline files were stored.', tone: 'info' })).catch(() => setNotice({ message: 'Offline files could not be cleared. Use your browser site-data controls instead.', tone: 'error' }))}>Reset offline files</button></p>
              </details>
              <details>
                <summary>Are there browser conversion limits?</summary>
                <p>Yes. Large audio and video jobs can be CPU- and memory-intensive, especially on mobile devices. Codec support and maximum workable file size depend on the browser and device.</p>
              </details>
              <details>
                <summary>Does conversion preserve metadata?</summary>
                <p>No. Converted files do not retain source metadata. Keep the original file whenever its embedded metadata is important.</p>
              </details>
            </div>
          </section>
        </div>
      ) : (
        <section className="queue-shell" aria-labelledby="queue-heading">
          <div className="queue-heading"><div><p className="eyebrow">Conversion queue</p><h1 id="queue-heading">{items.length} {items.length === 1 ? 'file' : 'files'} in queue</h1></div><div className="queue-add-actions"><button className="button button--add" type="button" disabled={busy} onClick={openLinkDialog}><Icon name="link" />Paste link</button><button className="button button--add" type="button" disabled={busy} onClick={() => inputRef.current?.click()}><Icon name="plus" />Add files</button></div><input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} aria-label="Add image, audio, or video files" tabIndex={-1} onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} /></div>
          <div className="queue-list" role="list" aria-label="Conversion queue">
            {items.map((item) => (
              <article key={item.id} className={`queue-card queue-card--${item.detected.kind}`} role="listitem">
                <div className="queue-row">
                  <div className="queue-file"><span className="file-glyph" aria-hidden="true"><Icon name={item.detected.kind} /></span><span className="file-copy"><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)} · {formatKind(item.detected.kind)}{item.sourceWidth ? ` · ${item.sourceWidth} × ${item.sourceHeight}` : ''}</small></span></div>
                  <div className="conversion-route" aria-label={`${item.detected.format} to ${item.options.outputFormat}`}><span className="format-chip">{item.detected.format.toUpperCase()}</span><span className="route-arrow"><Icon name="arrow" /></span><label><span className="sr-only">Output format for {item.file.name}</span><select aria-label={`Output format for ${item.file.name}`} disabled={busy || item.status === 'completed'} value={item.options.outputFormat} onChange={(event) => updateOptions(item, { ...item.options, outputFormat: event.target.value as MediaFormat, videoCodec: 'auto' })}>{getOutputFormats(item.detected.format).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}</select></label></div>
                  <div className="row-actions"><button type="button" onClick={() => openPreview(item)}><Icon name="preview" />Preview</button>{item.status === 'completed' ? <button type="button" onClick={() => editCompleted(item)}><Icon name="options" />Edit</button> : <button type="button" disabled={busy} onClick={() => openOptions(item)}><Icon name="options" />Options</button>}<button className="remove" type="button" disabled={item.id === activeIdRef.current} onClick={() => removeItem(item)} aria-label={`Remove ${item.file.name}`}><Icon name="remove" /></button></div>
                  <span className={`status status--${item.status}`}>{statusLabel(item)}</span>
                </div>
                {(item.status === 'converting' || item.status === 'loading-engine') && <div className={`progress ${item.status === 'loading-engine' || item.detected.kind === 'image' ? 'progress--indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.status === 'converting' && item.detected.kind !== 'image' ? Math.round(item.progress * 100) : undefined}><span style={item.status === 'converting' && item.detected.kind !== 'image' ? { width: `${Math.round(item.progress * 100)}%` } : undefined} /><small>{statusLabel(item)}{item.status === 'converting' && item.detected.kind !== 'image' ? ` · ${Math.round(item.progress * 100)}%` : ''}</small></div>}
                {item.warning && <p className="row-message row-message--warn">{item.warning}</p>}
                {item.error && <p className="row-message" role="alert">{item.error}</p>}
                {item.status === 'completed' && <div className="inline-result"><span><strong>{item.outputName}</strong><small>{formatBytes(item.outputBlob?.size ?? 0)}{item.resultWidth && item.resultHeight ? ` · ${item.resultWidth} × ${item.resultHeight}` : ''} · {resultChangeLabel(item)} · {formatDuration(item.durationMs)}</small></span><a href={item.outputUrl} download={item.outputName}><Icon name="download" />Download</a></div>}
              </article>
            ))}
          </div>
          <div className="queue-footer"><div><strong>{actionableCount ? `${actionableCount} ${actionableCount === 1 ? 'file' : 'files'} ready to convert` : 'All files converted'}</strong><span>{completed.length ? `${completed.length} completed` : 'Everything stays on this device'}</span></div><div className="queue-footer__actions"><button type="button" className="text-action" disabled={!items.some((item) => item.status === 'completed' || item.status === 'cancelled')} onClick={clearCompleted}>Clear finished</button>{completed.length > 1 && <button type="button" className="button" disabled={busy} onClick={() => void downloadAll().catch((error: unknown) => setNotice({ message: friendlyError(error), tone: 'error' }))}><Icon name="archive" />Download ZIP</button>}{busy ? <button type="button" className="button button--cancel" onClick={cancel}><Icon name="cancel" />Cancel</button> : actionableCount > 0 && <button type="button" className="button button--convert" onClick={() => void convertIds(items.filter((item) => item.status !== 'completed').map((item) => item.id))}>Convert {actionableCount > 1 ? actionableCount : ''}<Icon name="arrow" /></button>}</div></div>
        </section>
      )}

      {notice && <div className={`notice notice--${notice.tone}`} role="alert"><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="remove" /></button></div>}
      </div>

      {linkOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeLinkDialog() }}>
          <section ref={dialogRef} className="link-dialog" role="dialog" aria-modal="true" aria-labelledby="link-heading" aria-describedby="link-description">
            <header><div><p className="eyebrow">Import media</p><h2 id="link-heading">Paste a link</h2></div><button type="button" className="modal-close" onClick={closeLinkDialog} aria-label="Close link importer"><Icon name="remove" /></button></header>
            <div className="link-body">
              <form onSubmit={(event) => { event.preventDefault(); void submitLink() }}>
                <label htmlFor="media-link">Media link</label>
                <div className="link-field"><input id="media-link" type="url" inputMode="url" autoComplete="url" required placeholder="https://…" value={linkUrl} disabled={linkState.status === 'loading'} onChange={(event) => { setLinkUrl(event.target.value); if (linkState.status !== 'idle') setLinkState({ status: 'idle' }) }} /><button className="button button--primary" type="submit" disabled={linkState.status === 'loading' || !linkUrl.trim()}>{linkState.status === 'loading' ? <><span className="button-spinner" />Importing…</> : <><Icon name="link" />Add link</>}</button></div>
                <p id="link-description">Paste a direct HTTPS media link, public SoundCloud track, share link, or unlisted track link. Convert it locally and the converted result downloads automatically.</p>
              </form>
              {linkState.status === 'loading' && <div className="link-progress" role="status"><span>{linkState.loaded ? 'Downloading media' : 'Resolving link'}{linkState.total ? ` · ${Math.round(linkState.loaded / linkState.total * 100)}%` : linkState.loaded ? ` · ${formatBytes(linkState.loaded)}` : '…'}</span>{linkState.total && <progress max={linkState.total} value={linkState.loaded} aria-label="Link download progress" />}</div>}
              {linkState.status === 'error' && <p className="link-error" role="alert">{linkState.message}</p>}
            </div>
          </section>
        </div>
      )}

      {selected && optionsOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOptionsOpen(false) }}>
          <section ref={dialogRef} className="options-dialog" role="dialog" aria-modal="true" aria-labelledby="options-heading">
            <header><div><p className="eyebrow">{formatKind(selected.detected.kind)} options</p><h2 id="options-heading">{selected.file.name}</h2></div><button type="button" className="modal-close" onClick={() => setOptionsOpen(false)} aria-label="Close options"><Icon name="remove" /></button></header>
            <div className="dialog-route"><span>{selected.detected.format.toUpperCase()}</span><i>→</i><strong>{selected.options.outputFormat.toUpperCase()}</strong></div>
            <div className="options-body">
              {isImageFormat(selected.detected.format) && <>
                {(selected.options.outputFormat === 'jpg' || selected.options.outputFormat === 'webp') && <OptionGroup title="Image quality" help="Lower quality creates smaller files. Balanced is recommended for most images."><Segmented label="Image quality presets">{IMAGE_QUALITY_PRESETS.map((preset) => <button key={preset.label} type="button" aria-pressed={Math.abs(selected.options.quality - preset.value) < .02} onClick={() => updateOptions(selected, { ...selected.options, quality: preset.value })}>{preset.label}</button>)}</Segmented><label className="range-row">Exact quality <span>{Math.round(selected.options.quality * 100)}%</span><input aria-label="Exact image quality" type="range" min=".1" max="1" step=".01" value={selected.options.quality} onChange={(event) => updateOptions(selected, { ...selected.options, quality: Number(event.target.value) })} /></label></OptionGroup>}
                <details className="advanced-settings"><summary>Dimensions and transparency</summary><div className="advanced-content"><div className="dimension-fields"><label>Width<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.width ?? ''} onChange={(event) => updateOptions(selected, { ...selected.options, width: event.target.value ? Number(event.target.value) : undefined })} /></label><span>×</span><label>Height<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.height ?? ''} onChange={(event) => updateOptions(selected, { ...selected.options, height: event.target.value ? Number(event.target.value) : undefined })} /></label></div><label className="check"><input type="checkbox" checked={selected.options.lockAspectRatio} onChange={(event) => updateOptions(selected, { ...selected.options, lockAspectRatio: event.target.checked })} /> Lock aspect ratio</label><label className="check"><input type="checkbox" checked={selected.options.preventUpscale} onChange={(event) => updateOptions(selected, { ...selected.options, preventUpscale: event.target.checked })} /> Never enlarge smaller images</label>{selected.options.outputFormat === 'jpg' && <label className="color-row">Transparent pixels <span><input type="color" value={selected.options.jpgBackgroundColor} onChange={(event) => updateOptions(selected, { ...selected.options, jpgBackgroundColor: event.target.value })} />{selected.options.jpgBackgroundColor}</span></label>}</div></details>
              </>}

              {selectedOutputIsVideo && <>
                <OptionGroup title="Video quality" help="The selected resolution is a maximum. Smaller videos are never enlarged."><Segmented label="Video quality presets">{VIDEO_QUALITIES.map((preset) => <button key={preset.value} type="button" aria-pressed={selected.options.videoQuality === preset.value} onClick={() => updateOptions(selected, { ...selected.options, videoQuality: preset.value })}>{preset.label}</button>)}</Segmented></OptionGroup>
                <OptionGroup title="Maximum resolution" help="If this resolution is unavailable, the original dimensions are preserved within the selected limit."><Segmented label="Maximum video resolution">{VIDEO_RESOLUTIONS.map((preset) => <button key={preset.label} type="button" aria-pressed={selected.options.videoResolution === preset.value} onClick={() => updateOptions(selected, { ...selected.options, videoResolution: preset.value })}>{preset.label}</button>)}</Segmented></OptionGroup>
                <OptionGroup title="Video codec" help="The codec is selected from the output container so the result remains widely playable."><div className="codec-summary"><span>{selected.options.outputFormat.toUpperCase()}</span><strong>{selected.options.outputFormat === 'mp4' ? 'H.264 + AAC' : 'VP8 + Opus'}</strong></div></OptionGroup>
              </>}

              {(selected.detected.kind === 'audio' || selectedOutputIsAudio || selectedOutputIsVideo) && <>
                <OptionGroup title={selectedOutputIsVideo ? 'Audio bitrate' : 'Audio quality'} help={selected.options.outputFormat === 'wav' ? 'WAV is uncompressed, so bitrate does not apply.' : 'Higher bitrates improve fidelity but increase file size.'}><Segmented label={selectedOutputIsVideo ? 'Video audio bitrate' : 'Audio bitrate'}>{AUDIO_BITRATES.map((value) => <button key={value} type="button" disabled={selected.options.outputFormat === 'wav'} aria-pressed={selected.options.audioBitrate === value} onClick={() => updateOptions(selected, { ...selected.options, audioBitrate: value })}>{value}k</button>)}</Segmented></OptionGroup>
                {selectedOutputIsAudio && <div className="two-column-options"><OptionGroup title="Channels"><Segmented label="Audio channels"><button type="button" aria-pressed={selected.options.audioChannels === 'source'} onClick={() => updateOptions(selected, { ...selected.options, audioChannels: 'source' })}>Source</button><button type="button" aria-pressed={selected.options.audioChannels === 1} onClick={() => updateOptions(selected, { ...selected.options, audioChannels: 1 as AudioChannels })}>Mono</button><button type="button" aria-pressed={selected.options.audioChannels === 2} onClick={() => updateOptions(selected, { ...selected.options, audioChannels: 2 as AudioChannels })}>Stereo</button></Segmented></OptionGroup><OptionGroup title="Sample rate"><select aria-label="Audio sample rate" value={selected.options.audioSampleRate} onChange={(event) => updateOptions(selected, { ...selected.options, audioSampleRate: (event.target.value === 'source' ? 'source' : Number(event.target.value)) as AudioSampleRate })}><option value="source">Source</option><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select></OptionGroup></div>}
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
          <section ref={dialogRef} className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-heading"><header><div><p className="eyebrow">{selected.outputUrl ? 'Before and after' : 'Source preview'}</p><h2 id="preview-heading">{selected.file.name}</h2></div><button type="button" className="modal-close" onClick={() => setPreviewOpen(false)} aria-label="Close preview"><Icon name="remove" /></button></header><div className="preview-body">
            {selected.detected.kind === 'image' && sourcePreviewUrl ? <><div className="image-compare"><img src={sourcePreviewUrl} alt={`Source preview of ${selected.file.name}`} />{selected.outputUrl && <div className="result-layer" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}><img src={selected.outputUrl} alt={`Converted preview of ${selected.file.name}`} /></div>}{selected.outputUrl && <div className="compare-line" style={{ left: `${comparePosition}%` }}><span>↔</span></div>}</div>{selected.outputUrl && <label className="compare-control">Comparison position<input type="range" min="0" max="100" value={comparePosition} onChange={(event) => setComparePosition(Number(event.target.value))} /></label>}</> : selected.detected.kind === 'video' && sourcePreviewUrl ? <div className="media-preview"><span id={`source-media-${selected.id}`}>Source</span><video aria-labelledby={`source-media-${selected.id}`} controls preload="metadata" src={sourcePreviewUrl} />{selected.outputUrl && <><span id={`result-media-${selected.id}`}>Result</span>{isVideoFormat(selected.options.outputFormat) ? <video aria-labelledby={`result-media-${selected.id}`} controls preload="metadata" src={selected.outputUrl} /> : <audio aria-labelledby={`result-media-${selected.id}`} controls preload="metadata" src={selected.outputUrl} />}</>}</div> : sourcePreviewUrl ? <div className="media-preview"><span id={`source-media-${selected.id}`}>Source</span><audio aria-labelledby={`source-media-${selected.id}`} controls preload="metadata" src={sourcePreviewUrl} />{selected.outputUrl && <><span id={`result-media-${selected.id}`}>Result</span><audio aria-labelledby={`result-media-${selected.id}`} controls preload="metadata" src={selected.outputUrl} /></>}</div> : <div className="preview-placeholder">Preview unavailable in this browser.</div>}
          </div>{selected.outputBlob && <footer className="preview-result"><div><span>Result</span><strong>{formatBytes(selected.outputBlob.size)}</strong><small>{selected.resultWidth && selected.resultHeight ? `${selected.resultWidth} × ${selected.resultHeight} · ` : ''}{resultChangeLabel(selected)} · {formatDuration(selected.durationMs)}</small></div><a className="button button--primary" href={selected.outputUrl} download={selected.outputName}><Icon name="download" />Download result</a></footer>}</section>
        </div>
      )}


      <div className="sr-only" aria-live="polite" aria-atomic="true">{busy ? items.find((item) => item.status === 'converting' || item.status === 'loading-engine')?.phaseLabel : queueAnnouncement}</div>
    </main>
  )
}

function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return <div className="segmented" role="group" aria-label={label}>{children}</div>
}

function OptionGroup({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return <section className="option-group"><h3>{title}</h3>{children}{help && <p>{help}</p>}</section>
}

export default App
