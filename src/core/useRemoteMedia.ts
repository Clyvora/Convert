import { useCallback, useEffect, useRef, useState } from 'react'
import { remoteMedia } from './mediaClient'
import type { Capabilities, Discovery, Inspection, Item, Job, Page } from './mediaClient'
import type { Mode } from './remoteContracts'
import { loadRemotePreferences, outputFor, REMOTE_PREFERENCE_KEY } from './remotePreferences'
import { readInterfacePreferences } from './interfacePreferences'

export type Panel = 'settings' | 'queue' | 'services' | 'collection' | 'about' | 'updates' | null
const terminal = new Set(['ready', 'partial', 'failed', 'cancelled', 'expired'])

export function useRemoteMedia() {
  const [preferences, setPreferences] = useState(loadRemotePreferences)
  const [url, setURLState] = useState(''), [inspection, setInspection] = useState<Inspection | null>(null)
  const [caps, setCaps] = useState<Capabilities | null>(null), [jobs, setJobs] = useState<Job[]>([])
  const [panel, setPanel] = useState<Panel>(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [needsChoice, setNeedsChoice] = useState(false)
  const [deliveryTick, setDeliveryTick] = useState(0)
  const [discovery, setDiscovery] = useState<Discovery | null>(null), [page, setPage] = useState<Page<Item>>({ items: [], next: null })
  const [selected, setSelected] = useState<Set<string>>(new Set()), [all, setAll] = useState(false), [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState<Mode>('combined')
  const [results, setResults] = useState<{ id: string; page: Page<Item> } | null>(null)
  const [limit, setLimit] = useState(1000), [after, setAfter] = useState(''), [before, setBefore] = useState('')
  const lock = useRef(false), edited = useRef(false), controller = useRef<AbortController | null>(null)
  const currentDiscovery = useRef(discovery), cursor = useRef(''), mounted = useRef(true)
  const submission = useRef<{ body: string; key: string } | null>(null)
  const pendingDownloads = useRef(new Set<string>()), attemptedDownloads = useRef(new Set<string>())
  const deliveryAttempts = useRef(new Map<string, number>()), deliveryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const deliveryClickedAt = useRef(new Map<string, number>())
  currentDiscovery.current = discovery

  const deliver = useCallback(async (artifactId: string, allowed: () => boolean = () => true) => {
    const access = await remoteMedia.access(artifactId)
    if (!mounted.current || !allowed()) return
    const target = new URL(access.url, location.origin)
    if (!['https:', ...(import.meta.env.DEV ? ['http:'] : [])].includes(target.protocol) || target.username || target.password) throw new Error('The service returned an invalid download address.')
    const link = document.createElement('a')
    link.href = target.href; link.rel = 'noreferrer'; link.download = access.name
    document.body.append(link); link.click(); link.remove()
  }, [])

  useEffect(() => {
    mounted.current = true
    const timers = deliveryTimers.current, request = controller
    let stopped = false, restored = false, refreshing = false, timer: ReturnType<typeof setTimeout>
    async function refresh() {
      if (refreshing || stopped) return
      refreshing = true
      try {
        if (navigator.onLine !== false) {
          const [capabilities, queue] = await Promise.all([remoteMedia.capabilities(), remoteMedia.jobs()])
          if (stopped) return
          setCaps(capabilities); setJobs(queue.items)
          if (!restored) {
            const recent = await remoteMedia.discoveries()
            restored = true
            const unfinished = recent.items.find(d => !d.lastJobId && ['discovering', 'ready', 'failed', 'interrupted'].includes(d.state))
            if (unfinished && !stopped && !edited.current) { setDiscovery(unfinished); setURLState(unfinished.url || ''); setStatus('A previous collection is available.'); setPage(await remoteMedia.discoveryItems(unfinished.id)) }
          }
          const d = currentDiscovery.current
          if (d?.state === 'discovering') {
            const current = await remoteMedia.discovery(d.id), currentCursor = cursor.current
            const items = await remoteMedia.discoveryItems(d.id, currentCursor)
            if (!stopped && currentDiscovery.current?.id === d.id) { setDiscovery(current); if (cursor.current === currentCursor) setPage(items) }
          }
        }
      } catch { /* Reconcile when connectivity returns; explicit actions show their errors. */ }
      finally { refreshing = false; if (!stopped) timer = setTimeout(() => void refresh(), document.hidden ? 15000 : 2000) }
    }
    void refresh()
    const reconnect = () => { clearTimeout(timer); void refresh() }
    const visible = () => { if (!document.hidden) reconnect() }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', visible)
    return () => { stopped = true; mounted.current = false; clearTimeout(timer); for (const timeout of timers.values()) clearTimeout(timeout); timers.clear(); request.current?.abort(); window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', visible) }
  }, [])

  useEffect(() => {
    for (const job of jobs) {
      if (!pendingDownloads.current.has(job.id)) continue
      if (job.deliveredAt) { pendingDownloads.current.delete(job.id); setStatus('Download sent to your browser.'); continue }
      if (['ready', 'partial'].includes(job.state) && job.artifactId) {
        const identity = `${job.id}:${job.artifactId}`
        // Mark before awaiting access so polling and StrictMode cannot duplicate delivery.
        if (attemptedDownloads.current.has(identity)) continue
        attemptedDownloads.current.add(identity)
        const attempt = (deliveryAttempts.current.get(identity) || 0) + 1
        deliveryAttempts.current.set(identity, attempt)
        void deliver(job.artifactId, () => pendingDownloads.current.has(job.id)).then(() => { deliveryClickedAt.current.set(identity, Date.now()) }).catch(failure => {
          if (!mounted.current || !pendingDownloads.current.has(job.id)) return
          const retryable = failure instanceof TypeError || failure && typeof failure === 'object' && 'retryable' in failure && failure.retryable === true
          if (retryable && attempt < 3) {
            const retryAfter = typeof failure.retryAfter === 'number' ? failure.retryAfter * 1000 : 0
            deliveryTimers.current.set(identity, setTimeout(() => {
              deliveryTimers.current.delete(identity)
              if (mounted.current && pendingDownloads.current.has(job.id)) { attemptedDownloads.current.delete(identity); setDeliveryTick(tick => tick + 1) }
            }, Math.max(1000 * 2 ** attempt, retryAfter)))
          } else {
            pendingDownloads.current.delete(job.id)
            setError('Your file is ready. Use Download file in the queue if it did not start.'); setPanel('queue')
          }
        })
      } else if (terminal.has(job.state)) {
        pendingDownloads.current.delete(job.id)
        if (job.state === 'failed') setError(job.error?.message || 'The download failed. Open the queue for details and retry options.')
      }
    }
  }, [jobs, deliver, deliveryTick])
  useEffect(() => { try { localStorage.setItem(REMOTE_PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Optional non-sensitive settings. */ } }, [preferences])

  const action = useCallback(async (work: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await work() } catch (e) { if (mounted.current) { setError(e instanceof Error ? e.message : 'This operation could not be completed.'); setStatus('') } }
    finally { lock.current = false; if (mounted.current) setBusy(false) }
  }, [])
  function setURL(value: string) { edited.current = true; setURLState(value); setInspection(null); setDiscovery(null); setNeedsChoice(false); setError(''); setStatus('') }
  async function enqueue(input: unknown) {
    const body = JSON.stringify(input)
    if (submission.current?.body !== body) submission.current = { body, key: crypto.randomUUID() }
    const job = await remoteMedia.create(input, submission.current.key)
    if (!mounted.current) return
    if (readInterfacePreferences().autoDownload) pendingDownloads.current.add(job.id)
    setJobs(current => [job, ...current.filter(j => j.id !== job.id)])
    setStatus(readInterfacePreferences().autoDownload ? 'Added to your queue. Your download will start when ready.' : 'Added to your queue. Open it to download when ready.'); if (readInterfacePreferences().autoOpenQueue) setPanel('queue'); setNeedsChoice(false); submission.current = null
  }
  const submit = () => action(async () => {
    edited.current = true; controller.current = new AbortController(); setStatus('Checking your link…')
    try {
      const result = await remoteMedia.inspect(url, controller.current.signal)
      if (!mounted.current) return
      setInspection(result)
      if (result.kind !== 'media') {
        setBatchMode(preferences.mode === 'audio' ? 'audio' : preferences.mode === 'video' ? 'video' : 'combined')
        setPanel('collection'); setStatus('Choose the items you want to download.'); return
      }
      try { await enqueue({ inspectionId: result.id, output: outputFor(preferences, result) }) }
      catch (e) { setNeedsChoice(true); throw e }
    } finally { controller.current = null }
  })
  const discover = () => action(async () => {
    const d = await remoteMedia.discover({ url, limit, after: after.replaceAll('-', '') || undefined, before: before.replaceAll('-', '') || undefined })
    cursor.current = ''; setDiscovery(d); setPage({ items: [], next: null }); setSelected(new Set()); setExcluded(new Set()); setAll(false); setStatus('Discovering public items…')
    setPage(await remoteMedia.discoveryItems(d.id))
  })
  const createCollection = () => action(async () => {
    if (!discovery) return
    await enqueue({ discoveryId: discovery.id, all, itemIds: [...selected], excludedIds: [...excluded], output: outputFor(preferences, undefined, batchMode) })
  })
  const loadPage = (next = '') => action(async () => { if (!discovery) return; cursor.current = next; setPage(await remoteMedia.discoveryItems(discovery.id, next)) })
  const download = (id: string) => action(async () => {
    const job = jobs.find(job => job.artifactId === id)
    if (job) attemptedDownloads.current.add(`${job.id}:${id}`)
    await deliver(id)
    if (job) deliveryClickedAt.current.set(`${job.id}:${id}`, Date.now())
  })
  const cancel = (id: string) => action(async () => { pendingDownloads.current.delete(id); await remoteMedia.cancel(id); setJobs((await remoteMedia.jobs()).items) })
  const retry = (id: string) => action(async () => { const job = await remoteMedia.retry(id); if (readInterfacePreferences().autoDownload) pendingDownloads.current.add(id); setJobs(current => [job, ...current.filter(j => j.id !== id)]) })
  const remove = (id: string) => action(async () => { pendingDownloads.current.delete(id); await remoteMedia.remove(id); setJobs(current => current.filter(j => j.id !== id)); setResults(current => current?.id === id ? null : current) })
  const itemResults = (id: string, next = '') => action(async () => { setResults({ id, page: await remoteMedia.items(id, next) }) })
  const paste = () => action(async () => { setURL(await navigator.clipboard.readText()) })
  const cancelDiscovery = () => action(async () => { if (discovery) setDiscovery(await remoteMedia.cancel(discovery.id, true) as Discovery) })
  return {
    queueJobs: jobs.filter(job => !(['ready','expired'].includes(job.state) && job.deliveredAt)),
    recentJobs: jobs.filter(job => ['ready','expired'].includes(job.state) && job.deliveredAt),
    downloadNeedsAction: new Set(jobs.filter(job => job.artifactId && !job.deliveredAt && (deliveryClickedAt.current.get(`${job.id}:${job.artifactId}`) || Infinity) < Date.now() - 8000).map(job => job.id)),
    preferences, setPreferences, url, setURL, inspection, caps, jobs, panel, setPanel, busy, error, status, needsChoice,
    discovery, page, selected, setSelected, all, setAll, excluded, setExcluded, batchMode, setBatchMode,
    limit, setLimit, after, setAfter, before, setBefore, results, setResults,
    submit, paste, discover, createCollection, loadPage, download, cancel, retry, remove, itemResults, cancelDiscovery,
    cancelCheck: () => controller.current?.abort(), checking: busy && controller.current !== null,
    activeCount: jobs.filter(j => !terminal.has(j.state)).length,
  }
}
export type RemoteController = Omit<ReturnType<typeof useRemoteMedia>, 'setPanel'> & { setPanel: (panel: Panel) => void }
