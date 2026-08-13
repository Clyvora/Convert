import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import { defaultOptions } from './core/defaults'
import { detectFile, FileDetectionError } from './core/detection'
import { formatBytes, getLargeFileWarning } from './core/format'
import { outputFilename, uniqueFilename } from './core/naming'
import { getOutputFormats, isImageFormat } from './core/registry'
import { queueReducer } from './core/queue'
import type { QueueAction } from './core/queue'
import type { ConversionEngine, MediaFormat, QueueItem } from './core/types'

const ACCEPT = '.png,.jpg,.jpeg,.webp,.mp3,.wav,image/png,image/jpeg,image/webp,audio/mpeg,audio/wav'

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Conversion cancelled. You can retry when ready.'
  if (error instanceof Error) return error.message
  return 'Conversion failed. The source may be damaged or too large for this browser.'
}

function App() {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [dropActive, setDropActive] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
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

  const selected = items.find((item) => item.id === selectedId) ?? items.find((item) => item.status === 'ready' || item.status === 'failed') ?? null
  const completed = items.filter((item) => item.status === 'completed' && item.outputBlob)
  const actionableCount = items.filter((item) => ['ready', 'failed', 'cancelled'].includes(item.status)).length

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    const additions: QueueItem[] = []
    const errors: string[] = []
    for (const file of files) {
      try {
        const detected = await detectFile(file)
        additions.push({
          id: makeId(),
          file,
          detected,
          options: defaultOptions(detected.format),
          status: 'ready',
          progress: 0,
          warning: getLargeFileWarning(file),
        })
      } catch (error) {
        errors.push(error instanceof FileDetectionError ? `${file.name}: ${error.message}` : `${file.name}: Could not inspect this file.`)
      }
    }
    if (additions.length) {
      dispatch({ type: 'add', items: additions })
      setSelectedId((current) => current ?? additions[0].id)
    }
    setNotice(errors.join(' '))
  }, [])

  const applyQueueAction = (action: QueueAction) => {
    itemsRef.current = queueReducer(itemsRef.current, action)
    dispatch(action)
  }

  const patchItem = (id: string, patch: Partial<QueueItem>) => applyQueueAction({ type: 'update', id, patch })

  const reportProgress = (id: string, progress: number | null, label?: string) => {
    const normalized = progress ?? 0
    const now = performance.now()
    const previous = progressUpdateRef.current.get(id)
    const isMeasuredUpdate = progress !== null
    const isSmallUpdate = previous && label === previous.label && normalized < 1
      && Math.abs(normalized - previous.progress) < 0.01
      && now - previous.time < 100

    if (isMeasuredUpdate && isSmallUpdate) return
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
      const blob = await engine.convert(
        item.file,
        item.options,
        controller.signal,
        (progress, label) => reportProgress(id, progress, label),
      )
      controller.signal.throwIfAborted()
      const preferred = outputFilename(item.file.name, item.options.outputFormat)
      const name = uniqueFilename(preferred, usedNames)
      usedNames.add(name.toLowerCase())
      const url = URL.createObjectURL(blob)
      patchItem(id, { status: 'completed', progress: 1, outputBlob: blob, outputUrl: url, outputName: name, phaseLabel: 'Complete' })
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

  return (
    <main className={items.length ? 'app app--workspace' : 'app'}>
      <div className="ambient" aria-hidden="true"><i /><i /><i /></div>
      <header className="site-header">
        <a href="#top" className="brand" aria-label="Clyvora Convert home">
          <img src="/favicon.png" alt="" width="27" height="27" decoding="async" />
          <span>Clyvora <em>Convert</em></span>
        </a>
        <div className="local-badge"><span /> Local processing only</div>
      </header>

      <section id="top" className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Private media conversion</p>
        <h1 id="page-title">Convert files <em>locally.</em></h1>
        <p className="lede">No uploads, queues, or accounts. Fast image and audio conversion, handled entirely by your browser.</p>
        <p className="privacy"><span aria-hidden="true">◆</span> Your files never leave this device.</p>
      </section>

      <section
        className={`dropzone ${dropActive ? 'dropzone--active' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDropActive(true) }}
        onDragOver={(event) => { event.preventDefault(); setDropActive(true) }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDropActive(false) }}
        onDrop={(event) => { event.preventDefault(); setDropActive(false); void addFiles(Array.from(event.dataTransfer.files)) }}
        aria-label="Choose media files"
      >
        <input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPT} aria-label="Choose image or audio files" tabIndex={-1} onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
        <div className="drop-icon" aria-hidden="true"><span>↓</span></div>
        <div>
          <h2>Drop files here</h2>
          <p>or choose them from this device</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => inputRef.current?.click()}>Choose files</button>
        <div className="formats"><span>Images</span> PNG · JPG · WebP <b /> <span>Audio</span> MP3 · WAV</div>
      </section>

      {notice && <div className="notice notice--error" role="alert"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

      {items.length > 0 && (
        <section className="workspace" aria-labelledby="queue-heading">
          <div className="workspace-heading">
            <div><p className="eyebrow">Conversion workspace</p><h2 id="queue-heading">{items.length} {items.length === 1 ? 'file' : 'files'} in queue</h2></div>
            <div className="toolbar">
              <button type="button" className="button" disabled={busy || actionableCount === 0} onClick={() => void convertIds(items.filter((item) => item.status !== 'completed').map((item) => item.id))}>Convert all</button>
              <button type="button" className="button" disabled={!busy && !items.some((item) => item.status === 'ready')} onClick={cancel}>Cancel</button>
              <button type="button" className="button button--quiet" disabled={!items.some((item) => item.status === 'completed' || item.status === 'cancelled')} onClick={clearCompleted}>Clear completed</button>
            </div>
          </div>

          <div className="workspace-grid">
            <div className="queue-list" role="list" aria-label="Conversion queue">
              {items.map((item) => (
                <article key={item.id} className={`queue-card ${selected?.id === item.id ? 'queue-card--selected' : ''}`} role="listitem">
                  <button className="queue-main" type="button" onClick={() => setSelectedId(item.id)} aria-label={`Configure ${item.file.name}`}>
                    <span className={`file-glyph file-glyph--${item.detected.kind}`} aria-hidden="true">{item.detected.kind === 'image' ? '◫' : '♪'}</span>
                    <span className="file-copy"><strong>{item.file.name}</strong><small>{item.detected.format.toUpperCase()} · {formatBytes(item.file.size)} → {item.options.outputFormat.toUpperCase()}</small></span>
                    <span className={`status status--${item.status}`}>{item.status.replace('-', ' ')}</span>
                  </button>
                  {(item.status === 'converting' || item.status === 'loading-engine') && <div className={`progress ${item.detected.kind === 'image' || item.status === 'loading-engine' ? 'progress--indeterminate' : ''}`} role="progressbar" aria-label={`${item.phaseLabel ?? 'Converting'} ${item.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.detected.kind === 'audio' && item.status === 'converting' ? Math.round(item.progress * 100) : undefined} aria-valuetext={item.detected.kind === 'audio' && item.status === 'converting' ? `${Math.round(item.progress * 100)} percent` : item.phaseLabel}><span style={item.detected.kind === 'audio' && item.status === 'converting' ? { width: `${Math.round(item.progress * 100)}%` } : undefined} /><small>{item.phaseLabel}{item.detected.kind === 'audio' && item.status === 'converting' ? ` · ${Math.round(item.progress * 100)}%` : ''}</small></div>}
                  {item.warning && <p className="row-message row-message--warn">{item.warning}</p>}
                  {item.error && <p className="row-message" role="alert">{item.error}</p>}
                  <div className="queue-actions">
                    {item.outputUrl && <a className="text-action" href={item.outputUrl} download={item.outputName}>Download <span>{formatBytes(item.outputBlob?.size ?? 0)}</span></a>}
                    {(item.status === 'failed' || item.status === 'cancelled') && <button className="text-action" type="button" disabled={busy} onClick={() => void convertIds([item.id])}>Retry</button>}
                    <button className="remove" type="button" disabled={item.id === activeIdRef.current} onClick={() => removeItem(item)} aria-label={`Remove ${item.file.name}`}>×</button>
                  </div>
                </article>
              ))}
            </div>

            <aside className="settings" aria-labelledby="settings-heading">
              <p className="eyebrow">File settings</p>
              <h3 id="settings-heading">{selected ? selected.file.name : 'Select a file'}</h3>
              {selected ? (
                <fieldset disabled={busy || selected.status === 'completed'}>
                  <label>Output format
                    <select value={selected.options.outputFormat} onChange={(event) => patchItem(selected.id, { options: { ...selected.options, outputFormat: event.target.value as MediaFormat } })}>
                      {getOutputFormats(selected.detected.format).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
                    </select>
                  </label>

                  {isImageFormat(selected.detected.format) && (
                    <>
                      {(selected.options.outputFormat === 'jpg' || selected.options.outputFormat === 'webp') && <label>Quality <span>{Math.round(selected.options.quality * 100)}%</span>
                        <input type="range" min="0.1" max="1" step="0.05" value={selected.options.quality} onChange={(event) => patchItem(selected.id, { options: { ...selected.options, quality: Number(event.target.value) } })} />
                      </label>}
                      <div className="field-group"><span>Resize (optional)</span><div className="dimension-fields">
                        <label>Width<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.width ?? ''} onChange={(event) => patchItem(selected.id, { options: { ...selected.options, width: event.target.value ? Number(event.target.value) : undefined } })} /></label>
                        <span aria-hidden="true">×</span>
                        <label>Height<input type="number" min="1" max="32767" placeholder="Original" value={selected.options.height ?? ''} onChange={(event) => patchItem(selected.id, { options: { ...selected.options, height: event.target.value ? Number(event.target.value) : undefined } })} /></label>
                      </div></div>
                      <label className="check"><input type="checkbox" checked={selected.options.lockAspectRatio} onChange={(event) => patchItem(selected.id, { options: { ...selected.options, lockAspectRatio: event.target.checked } })} /> Lock aspect ratio</label>
                      {selected.options.outputFormat === 'jpg' && <label>Transparency background<div className="color-field"><input type="color" value={selected.options.jpgBackgroundColor} onChange={(event) => patchItem(selected.id, { options: { ...selected.options, jpgBackgroundColor: event.target.value } })} /><code>{selected.options.jpgBackgroundColor}</code></div></label>}
                    </>
                  )}

                  {selected.detected.kind === 'audio' && selected.options.outputFormat === 'mp3' && <label>MP3 bitrate
                    <select value={selected.options.mp3Bitrate} onChange={(event) => patchItem(selected.id, { options: { ...selected.options, mp3Bitrate: Number(event.target.value) as 128 | 192 | 256 | 320 } })}>
                      {[128, 192, 256, 320].map((value) => <option key={value} value={value}>{value} kbps</option>)}
                    </select>
                  </label>}
                  {selected.detected.format === 'mp3' && selected.options.outputFormat === 'wav' && <p className="hint">WAV will be larger. Converting cannot restore audio quality already lost in the MP3.</p>}
                  <button className="button button--primary button--full" type="button" disabled={busy || selected.status === 'completed'} onClick={() => void convertIds([selected.id])}>{selected.status === 'failed' || selected.status === 'cancelled' ? 'Retry conversion' : 'Convert file'}</button>
                </fieldset>
              ) : <p className="hint">Choose a queued file to adjust its result.</p>}
            </aside>
          </div>

          {completed.length > 1 && <div className="download-bar"><div><strong>{completedSummary}</strong><span>Download everything in one ZIP file. Large result sets may need extra memory.</span></div><button type="button" className="button button--primary" disabled={busy} onClick={() => void downloadAll().catch((error: unknown) => setNotice(friendlyError(error)))}>Download all as ZIP</button></div>}
        </section>
      )}

      <section className="privacy-detail" aria-labelledby="privacy-heading">
        <div><p className="eyebrow">Built for privacy</p><h2 id="privacy-heading">Nothing leaves your browser.</h2></div>
        <p>Images use native browser tools. Audio uses a locally cached FFmpeg engine. There is no server, account, analytics, or external conversion service—and filenames and contents are never logged.</p>
      </section>

      <footer><span>Clyvora Convert</span><span>Local-first · No tracking · No file transmission</span></footer>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{busy ? items.find((item) => item.status === 'converting' || item.status === 'loading-engine')?.phaseLabel : completedSummary}</div>
    </main>
  )
}

export default App
