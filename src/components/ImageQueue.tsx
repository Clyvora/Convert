import { useEffect, useRef, useState } from 'react'
import type { ImageFormat, ImageInfo } from '../engines/image/image'
import { formatBytes } from '../core/format'
import { outputFilename, uniqueFilename } from '../core/naming'
import { triggerDownload } from '../core/download'

export interface ImageEntry { id: string; file: File; info: ImageInfo }
interface Item extends ImageEntry { width: number; height: number; format: ImageFormat; quality: number; locked: boolean; status: string; error?: string; url?: string; name?: string }

export default function ImageQueue({ entries, busy, onBusy, onRemove }: { entries: ImageEntry[]; busy: boolean; onBusy: (value: boolean) => void; onRemove: (id: string) => void }) {
  const [items, setItems] = useState<Item[]>([])
  const current = useRef(items)
  const abort = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    setItems(old => entries.map(entry => old.find(item => item.id === entry.id) ?? { ...entry, width: entry.info.width, height: entry.info.height, format: entry.info.format, quality: .9, locked: true, status: 'Ready' }))
  }, [entries])
  useEffect(() => { current.current = items }, [items])
  useEffect(() => () => { abort.current?.abort(); for (const item of current.current) if (item.url) URL.revokeObjectURL(item.url) }, [])
  const patch = (id: string, values: Partial<Item>) => setItems(old => old.map(item => item.id === id ? { ...item, ...values } : item))
  const dimension = (item: Item, side: 'width' | 'height', value: number) => {
    const values = { [side]: value }
    if (item.locked) values[side === 'width' ? 'height' : 'width'] = Math.max(1, Math.round(value * (side === 'width' ? item.info.height / item.info.width : item.info.width / item.info.height)))
    patch(item.id, values)
  }
  const convert = async () => {
    if (busy || abort.current) return
    const controller = new AbortController(); abort.current = controller; setRunning(true); onBusy(true)
    const names = new Set(current.current.flatMap(item => item.name ? [item.name.toLowerCase()] : []))
    try {
      const { resizeImage } = await import('../engines/image/image')
      for (const item of current.current) {
        if (controller.signal.aborted) break
        if (item.url) continue
        try {
          patch(item.id, { status: 'Converting', error: undefined })
          const result = await resizeImage(item.file, item.info, { width: item.width, height: item.height, outputFormat: item.format, quality: item.quality, signal: controller.signal, onProgress: phase => patch(item.id, { status: phase }) })
          controller.signal.throwIfAborted()
          const name = uniqueFilename(outputFilename(item.file.name, item.format), names); names.add(name.toLowerCase())
          const url = URL.createObjectURL(result.blob)
          patch(item.id, { status: 'Complete', url, name }); triggerDownload(url, name)
        } catch (error) { patch(item.id, { status: controller.signal.aborted ? 'Cancelled' : 'Needs attention', error: error instanceof Error ? error.message : 'Could not convert this image.' }) }
      }
    } finally { abort.current = null; setRunning(false); onBusy(false) }
  }
  if (!items.length) return null
  return <section className="workspace image-workspace" aria-labelledby="image-title">
    <div className="workspace-heading"><div><p className="eyebrow">Local images</p><h2 id="image-title">Resize and convert images</h2></div></div>
    <div className="queue">{items.map(item => <article className="image-item" key={item.id}>
      <div className="file-details"><h3>{item.file.name}</h3><p>{formatBytes(item.file.size)} · {item.info.width} × {item.info.height} · {item.info.format.toUpperCase()}</p></div>
      <div className="image-options">
        <label>Width<input type="number" min="1" max="8192" value={item.width} disabled={busy || !!item.url} onChange={event => dimension(item, 'width', Number(event.target.value))} /></label>
        <label>Height<input type="number" min="1" max="8192" value={item.height} disabled={busy || !!item.url} onChange={event => dimension(item, 'height', Number(event.target.value))} /></label>
        <label>Format<select value={item.format} disabled={busy || !!item.url} onChange={event => patch(item.id, { format: event.target.value as ImageFormat })}>{['png', 'jpg', 'webp'].map(format => <option key={format} value={format}>{format.toUpperCase()}</option>)}</select></label>
        {item.format !== 'png' && <label>Quality<input type="number" min="1" max="100" value={Math.round(item.quality * 100)} disabled={busy || !!item.url} onChange={event => patch(item.id, { quality: Math.min(1, Math.max(.01, Number(event.target.value) / 100)) })} /></label>}
        <label className="aspect-lock"><input type="checkbox" checked={item.locked} disabled={busy || !!item.url} onChange={event => patch(item.id, { locked: event.target.checked })} /> Keep proportions</label>
      </div>
      {item.error && <p className="error-text" role="alert">{item.error}</p>}
      <div className="image-actions"><span role="status">{item.status}</span>{item.url && <button className="download-button" onClick={() => triggerDownload(item.url!, item.name!)}>Download</button>}<button className="remove-button" disabled={busy} aria-label={`Remove ${item.file.name}`} onClick={() => { if (item.url) URL.revokeObjectURL(item.url); onRemove(item.id) }}>×</button></div>
    </article>)}</div>
    <div className="queue-actions"><p>Images stay on this device. PNG keeps transparency; JPEG uses a white background.</p>{running ? <button className="danger-button" onClick={() => abort.current?.abort()}>Cancel images</button> : <button className="primary-button" disabled={busy || items.every(item => item.url)} onClick={() => void convert()}>Convert images</button>}</div>
  </section>
}
