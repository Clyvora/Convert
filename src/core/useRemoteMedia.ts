import { splitLinks, MAX_BATCH_LINKS, batchRequest, type LinkResult } from './linkBatch'
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
  const [checking, setChecking] = useState(false)
  const [linkResults, setLinkResults] = useState<LinkResult[]>([]), [addingLinks, setAddingLinks] = useState(false)
  const batchController = useRef<AbortController | null>(null)
  const [discovery, setDiscovery] = useState<Discovery | null>(null), [page, setPage] = useState<Page<Item>>({ items: [], next: null })
  const [selected, setSelected] = useState<Set<string>>(new Set()), [all, setAll] = useState(false), [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState<Mode>('combined')
  const [results, setResults] = useState<{ id: string; page: Page<Item> } | null>(null)
  const [limit, setLimit] = useState(1000), [after, setAfter] = useState(''), [before, setBefore] = useState('')
  const lock = useRef(false), edited = useRef(false), controller = useRef<AbortController | null>(null)
  const currentDiscovery = useRef(discovery), cursor = useRef(''), mounted = useRef(true)
  const submissions = useRef(new Map<string, string>())
  const pendingDownloads = useRef(new Set<string>()), attemptedDownloads = useRef(new Set<string>())
  const deliveryAttempts = useRef(new Map<string, number>()), deliveryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const deliveryClickedAt = useRef(new Map<string, number>())
  const queueRevision = useRef(0), refreshQueue = useRef<() => void>(() => {})
  const currentJobs = useRef(jobs)
  currentJobs.current = jobs
  currentDiscovery.current = discovery
  const activeWork = jobs.some(job => !terminal.has(job.state)) || discovery?.state === 'discovering'
  useEffect(() => { if (activeWork) refreshQueue.current() }, [activeWork])

  const deliver = useCallback(async (artifactId: string, allowed: () => boolean = () => true) => {
    const access = await remoteMedia.access(artifactId)
    if (!mounted.current || !allowed()) return
    const target = new URL(access.url, location.origin)
    if (!['https:', ...(import.meta.env.DEV ? ['http:'] : [])].includes(target.protocol) || target.username || target.password) throw new Error('The service returned an invalid download address.')
    const link = document.createElement('a')
    link.href = target.href; link.rel = 'noreferrer'; link.download = access.name
    document.body.append(link); link.click(); link.remove()
  }, [])

  const markDelivery = useCallback((identity: string) => {
    deliveryClickedAt.current.set(identity, Date.now())
    const key = `${identity}:notice`
    clearTimeout(deliveryTimers.current.get(key))
    deliveryTimers.current.set(key, setTimeout(() => {
      deliveryTimers.current.delete(key)
      if (mounted.current) setDeliveryTick(tick => tick + 1)
    }, 8100))
  }, [])

  useEffect(() => {
    mounted.current = true
    const timers = deliveryTimers.current, request = controller
    let stopped = false, restored = false, refreshing = false, refreshingDiscovery = false, refreshAgain = false, capabilitiesLoaded = false, loadingCapabilities = false, timer: ReturnType<typeof setTimeout>
    async function refresh() {
      if (stopped) return
      if (refreshing) { refreshAgain = true; return }
      refreshing = true
      try {
        if (navigator.onLine !== false) {
          if (!capabilitiesLoaded && !loadingCapabilities) {
            loadingCapabilities = true
            void remoteMedia.capabilities().then(value => { if (!stopped) { setCaps(value); capabilitiesLoaded = true } }).catch(() => {}).finally(() => { loadingCapabilities = false })
          }
          const revision = queueRevision.current
          const queue = await remoteMedia.jobs()
          if (stopped) return
          if (revision === queueRevision.current) {
            setJobs(current => JSON.stringify(current) === JSON.stringify(queue.items) ? current : queue.items)
            currentJobs.current = queue.items
          }
          if (!restored) {
            restored = true
            void (async () => {
            const recent = await remoteMedia.discoveries()
            const unfinished = recent.items.find(d => !d.lastJobId && ['discovering', 'ready', 'failed', 'interrupted'].includes(d.state))
            if (unfinished && !stopped && !edited.current) { setDiscovery(unfinished); setURLState(unfinished.url || ''); setStatus('A previous collection is available.'); const items = await remoteMedia.discoveryItems(unfinished.id); if (!stopped && !edited.current) setPage(items) }
            })().catch(() => { restored = false })
          }
          const d = currentDiscovery.current
          if (d?.state === 'discovering' && !refreshingDiscovery) {
            refreshingDiscovery = true
            const currentCursor = cursor.current
            void Promise.all([remoteMedia.discovery(d.id), remoteMedia.discoveryItems(d.id, currentCursor)])
              .then(([current, items]) => {
                if (!stopped && currentDiscovery.current?.id === d.id) { setDiscovery(current); if (cursor.current === currentCursor) setPage(items) }
              })
              .catch(() => { /* Retry collection refresh without delaying queue delivery. */ })
              .finally(() => { refreshingDiscovery = false })
          }
        }
      } catch { /* Reconcile when connectivity returns; explicit actions show their errors. */ }
      finally {
        refreshing = false
        const active = currentJobs.current.some(job => !terminal.has(job.state)) || currentDiscovery.current?.state === 'discovering'
        const delay = refreshAgain ? 0 : document.hidden ? 30000 : active ? 2000 : 30000
        refreshAgain = false
        if (!stopped) timer = setTimeout(() => void refresh(), delay)
      }
    }
    void refresh()
    const reconnect = () => { clearTimeout(timer); void refresh() }
    refreshQueue.current = () => {
      if (stopped) return
      clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 2000)
    }
    const visible = () => { if (!document.hidden) reconnect() }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', visible)
    return () => { stopped = true; mounted.current = false; clearTimeout(timer); for (const timeout of timers.values()) clearTimeout(timeout); timers.clear(); request.current?.abort(); batchController.current?.abort(); window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', visible) }
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
        void deliver(job.artifactId, () => pendingDownloads.current.has(job.id)).then(() => markDelivery(identity)).catch(failure => {
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
  }, [jobs, deliver, deliveryTick, markDelivery])
  useEffect(() => { try { localStorage.setItem(REMOTE_PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Optional non-sensitive settings. */ } }, [preferences])

  const action = useCallback(async (work: () => Promise<void>) => {
    if (lock.current) return
    queueRevision.current++; lock.current = true; setBusy(true); setError('')
    try { await work() } catch (e) { if (mounted.current) { setError(e instanceof Error ? e.message : 'This operation could not be completed.'); setStatus('') } }
    finally { queueRevision.current++; lock.current = false; if (mounted.current) { setBusy(false); refreshQueue.current() } }
  }, [])
  function setURL(value: string) { setLinkResults([]); edited.current = true; setURLState(value); setInspection(null); setDiscovery(null); setNeedsChoice(false); setError(''); setStatus('') }
  async function enqueue(input: unknown, openQueue = true) {
    const body = JSON.stringify(input)
    if (!submissions.current.has(body)) {
      if (submissions.current.size >= 100) submissions.current.delete(submissions.current.keys().next().value!)
      submissions.current.set(body, crypto.randomUUID())
    }
    queueRevision.current++
    const job = await remoteMedia.create(input, submissions.current.get(body)!)
    queueRevision.current++
    if (!mounted.current) return
    if (readInterfacePreferences().autoDownload) pendingDownloads.current.add(job.id)
    setJobs(current => [job, ...current.filter(j => j.id !== job.id)])
    setStatus(readInterfacePreferences().autoDownload ? 'Added to your queue. Your download will start when ready.' : 'Added to your queue. Open it to download when ready.'); if (openQueue && readInterfacePreferences().autoOpenQueue) setPanel('queue'); setNeedsChoice(false); submissions.current.delete(body)
  }
  const submit = () => action(async () => {
    const links = splitLinks(url)
    if (links.length > MAX_BATCH_LINKS) throw new Error(`Add up to ${MAX_BATCH_LINKS} links at a time.`)
    if (links.length > 1) {
      edited.current = true; setInspection(null); setNeedsChoice(false)
      const batch = new AbortController(); batchController.current = batch
      setAddingLinks(true); setLinkResults(links.map(url => ({ url, state: 'waiting' })))
      let queued = 0
      const update = (url: string, state: LinkResult['state'], message?: string) => {
        if (mounted.current) setLinkResults(current => current.map(item => item.url === url ? { url, state, message } : item))
      }
      try {
        for (const [index, link] of links.entries()) {
          if (batch.signal.aborted || !mounted.current) break
          update(link, 'checking'); setStatus(`Checking link ${index + 1} of ${links.length}…`)
          controller.current = batch; setChecking(true)
          try {
            let parsed: URL
            try { parsed = new URL(link) } catch { throw new Error('Enter a complete public URL.') }
            if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Enter an HTTP or HTTPS link.')
            const waitForService = () => { if (mounted.current) setStatus(`The service is busy. Waiting before continuing link ${index + 1} of ${links.length}…`) }
            const result = await batchRequest(() => remoteMedia.inspect(link, batch.signal), batch.signal, waitForService)
            batch.signal.throwIfAborted()
            if (result.kind !== 'media') throw new Error('Open this collection separately to choose its items.')
            setChecking(false); controller.current = null
            await batchRequest(() => enqueue({ inspectionId: result.id, output: outputFor(preferences, result) }, false), batch.signal, waitForService)
            queued++; update(link, 'queued')
          } catch (failure) {
            if (batch.signal.aborted) { update(link, 'cancelled'); break }
            update(link, 'failed', failure instanceof Error ? failure.message : 'Could not add this link.')
          } finally { controller.current = null; if (mounted.current) setChecking(false) }
        }
      } finally {
        batchController.current = null
        if (mounted.current) {
          setAddingLinks(false)
          if (queued === links.length && readInterfacePreferences().autoOpenQueue) setPanel('queue')
          setLinkResults(current => current.map(item => ['waiting', 'checking'].includes(item.state) ? { ...item, state: 'cancelled' } : item))
          setStatus(`${queued} of ${links.length} links added to your queue.${batch.signal.aborted ? ' Remaining links stopped.' : ''}`)
        }
      }
      return
    }
    setLinkResults([])
    edited.current = true
    const check = new AbortController()
    controller.current = check; setChecking(true); setStatus('Checking your link…')
    const slow = setTimeout(() => { if (mounted.current) setStatus('The source is still responding. You can cancel this check.') }, 4000)
    let result: Inspection
    try {
      result = await remoteMedia.inspect(links[0] || url.trim(), check.signal)
      check.signal.throwIfAborted()
    } finally {
      clearTimeout(slow); controller.current = null
      if (mounted.current) setChecking(false)
    }
    if (!mounted.current) return
    setInspection(result)
    if (result.kind !== 'media') {
      setBatchMode(preferences.mode === 'audio' ? 'audio' : preferences.mode === 'video' ? 'video' : 'combined')
      setPanel('collection'); setStatus('Choose the items you want to download.'); return
    }
    setStatus('Adding your download to the queue…')
    try { await enqueue({ inspectionId: result.id, output: outputFor(preferences, result) }) }
    catch (e) { setNeedsChoice(true); throw e }
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
    if (job) markDelivery(`${job.id}:${id}`)
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
    cancelCheck: () => controller.current?.abort(), checking, linkResults, addingLinks,
    stopAddingLinks: () => batchController.current?.abort(),
    activeCount: jobs.filter(j => !terminal.has(j.state)).length,
  }
}
export type RemoteController = Omit<ReturnType<typeof useRemoteMedia>, 'setPanel'> & { setPanel: (panel: Panel) => void }
