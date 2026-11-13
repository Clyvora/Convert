import { downloadInBrowser } from './browserDownload'
import type { BrowserPlan, Inspection, Item, Job, Output, Page } from './remoteContracts'

interface Input { inspectionId: string; output: Output }
interface Entry { job: Job; input: Input; key: string; controller: AbortController; plan: BrowserPlan; object?: string; size?: number; fallbackId?: string }
type Transport = {
  plan: (id: string, output: Output) => Promise<{ plan: BrowserPlan | null }>
  create: (input: unknown, key: string) => Promise<Job>
  cancel: (id: string) => Promise<Job>
  remove: (id: string) => Promise<unknown>
}

// Bytes and source URLs live only in this tab. Never use localStorage or SW caches.
export class BrowserQueue {
  private entries = new Map<string, Entry>()
  private eligible = new Map<string, Inspection>()
  private api: Transport
  constructor(api: Transport) { this.api = api }
  private changed() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('mewvi-browser-download')) }
  remember(inspection: Inspection) {
    if (!inspection.browserDownload) return
    if (this.eligible.size >= 100) this.eligible.delete(this.eligible.keys().next().value!)
    this.eligible.set(inspection.id, inspection)
  }
  async create(input: unknown, key: string): Promise<Job | null> {
    const value = input as Partial<Input> | null
    if (!value?.inspectionId || !value.output || !this.eligible.has(value.inspectionId)) return null
    const inspection = this.eligible.get(value.inspectionId)!
    const o = value.output
    if (!['original', 'mp4', 'm4a', 'mkv', 'webm', 'opus', 'ogg'].includes(o.container) || o.audioBitrate || o.sampleRate || o.channels || o.metadata || o.chapters || o.cover || o.subtitle || o.videoCodec && o.videoCodec !== 'source') return null
    for (const entry of this.entries.values()) if (entry.key === key) return { ...entry.job }
    if (this.entries.size >= 20) return null
    let plan: BrowserPlan | null
    try { plan = (await this.api.plan(value.inspectionId, o)).plan } catch { return null }
    if (!plan) return null
    for (const entry of this.entries.values()) if (entry.key === key) return { ...entry.job }
    if (this.entries.size >= 20) return null
    // Reserve each active transfer's full allowance, bounding aggregate blob memory.
    const reserved = [...this.entries.values()].reduce((n, e) => n + (e.object ? e.size || 0 : ['downloading', 'processing'].includes(e.job.state) ? e.plan.maxBytes : 0), 0)
    if (reserved + plan.maxBytes > 128 * 1024 ** 2) return null
    const id = `browser-${crypto.randomUUID()}`
    const job: Job = { id, title: inspection.title, state: 'downloading', created: Date.now(), expires: Date.now() + 86400000, output: o, total: 1, completed: 0, failed: 0, bytes: 0, stage: 'Downloading directly in your browser' }
    const entry: Entry = { job, input: value as Input, key, controller: new AbortController(), plan }
    this.entries.set(id, entry)
    this.changed()
    void this.run(entry)
    return { ...job }
  }
  private async run(entry: Entry) {
    const controller = entry.controller, id = entry.job.id
    const current = () => this.entries.get(id) === entry && entry.controller === controller
    try {
      const blob = await downloadInBrowser(entry.plan, controller.signal, (bytes, speed, processing) => {
        if (!current() || controller.signal.aborted) return
        Object.assign(entry.job, { bytes, transferSpeed: processing ? null : speed, progressUpdatedAt: Date.now(), ...(processing ? { state: 'processing', stage: 'Combining media on your device' } : {}) })
        this.changed()
      })
      if (!current() || controller.signal.aborted) return
      entry.object = URL.createObjectURL(blob); entry.size = blob.size
      Object.assign(entry.job, { state: 'ready', stage: 'Ready in this tab', bytes: blob.size, totalBytes: blob.size, completed: 1, artifactId: entry.job.id, transferSpeed: null })
    } catch {
      if (!current() || controller.signal.aborted) return
      Object.assign(entry.job, { state: 'queued', stage: 'Browser access unavailable. Using the standard download path.', transferSpeed: null, bytes: 0 })
      this.changed()
      try {
        const remote = await this.api.create(entry.input, entry.key)
        // A fallback can finish being created after its local entry was removed or retried.
        if (!current()) { await this.api.cancel(remote.id); await this.api.remove(remote.id); return }
        entry.fallbackId = remote.id
        entry.job = { ...remote, id: entry.job.id }
        if (controller.signal.aborted) {
          this.changed()
          try { const cancelled = await this.api.cancel(remote.id); if (current()) entry.job = { ...cancelled, id } }
          catch { if (current()) entry.job.stage = 'Cancellation could not be confirmed. Try again.' }
        }
      } catch {
        if (current() && !controller.signal.aborted) Object.assign(entry.job, { state: 'failed', stage: 'Download failed', failed: 1, error: { code: 'DOWNLOAD_FAILED', message: 'The browser and standard download paths were unavailable. Try again.', retryable: true } })
      }
    } finally { this.changed() }
  }
  has(id: string) { return this.entries.has(id) }
  reconcile(id: string, remote: Job) { const entry = this.entries.get(id)!; entry.controller.abort(); entry.controller = new AbortController(); entry.job = { ...remote, id }; this.changed(); return { ...entry.job } }
  remoteId(id: string) { return this.entries.get(id)?.fallbackId || id }
  merge(remote: Page<Job>): Page<Job> {
    for (const entry of this.entries.values()) if (entry.object && entry.job.expires <= Date.now()) {
      URL.revokeObjectURL(entry.object); entry.object = undefined; entry.size = 0
      Object.assign(entry.job, { state: 'expired', stage: 'Browser download expired', artifactId: undefined })
    }
    const hidden = new Set<string>()
    for (const entry of this.entries.values()) if (entry.fallbackId) {
      hidden.add(entry.fallbackId)
      const latest = remote.items.find(job => job.id === entry.fallbackId)
      if (latest && entry.job.state !== 'cancelled') entry.job = { ...latest, id: entry.job.id }
    }
    return { ...remote, items: [...this.entries.values()].map(e => ({ ...e.job })).concat(remote.items.filter(job => !hidden.has(job.id) && !this.entries.has(job.id))).sort((a, b) => b.created - a.created) }
  }
  access(id: string) {
    const entry = this.entries.get(id)
    if (!entry?.object || entry.job.state !== 'ready' || entry.job.expires <= Date.now()) return null
    return { url: entry.object, name: entry.plan.filename, expires: entry.job.expires, local: true }
  }
  delivered(id: string) { const entry = this.entries.get(id); if (entry?.object) { entry.job.deliveredAt = Date.now(); this.changed() } }
  async cancel(id: string) {
    const entry = this.entries.get(id)!
    if (entry.fallbackId) {
      const cancelled = await this.api.cancel(entry.fallbackId)
      entry.job = { ...cancelled, id }; this.changed()
      return { ...entry.job }
    }
    entry.controller.abort()
    Object.assign(entry.job, { state: 'cancelled', stage: 'Cancelled', transferSpeed: null })
    this.changed()
    return { ...entry.job }
  }
  async remove(id: string) {
    const entry = this.entries.get(id)!
    if (entry.fallbackId) await this.api.remove(entry.fallbackId)
    entry.controller.abort()
    if (entry.object) URL.revokeObjectURL(entry.object)
    this.entries.delete(id)
    this.changed()
  }
  async retry(id: string): Promise<Job> {
    const entry = this.entries.get(id)!
    if (entry.fallbackId) throw new Error('Remote retries must use the transport.')
    entry.controller.abort()
    entry.controller = new AbortController()
    const next = await this.api.create(entry.input, crypto.randomUUID())
    entry.fallbackId = next.id; entry.job = { ...next, id }
    this.changed()
    return { ...entry.job }
  }
  items(id: string): Page<Item> {
    const entry = this.entries.get(id)!
    return { items: [{ id, mediaId: this.eligible.get(entry.input.inspectionId)?.mediaId || id, provider: this.eligible.get(entry.input.inspectionId)?.provider || 'Media', url: '', title: entry.job.title || 'Media', state: entry.job.state, artifactId: entry.job.artifactId, error: entry.job.error }], next: null }
  }
}
