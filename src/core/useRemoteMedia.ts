import { splitLinks, MAX_BATCH_LINKS, batchRequest, type LinkResult } from './linkBatch'
import { useCallback, useEffect, useRef, useState } from 'react'
import { remoteMedia } from './mediaClient'
import type { Capabilities, Discovery, Inspection, Item, Job, Page } from './mediaClient'
import type { Mode } from './remoteContracts'
import { collectionModeFor, loadRemotePreferences, outputFor, REMOTE_PREFERENCE_KEY } from './remotePreferences'
import { youtubePlaylistURL } from './collectionLinks'
import { readInterfacePreferences } from './interfacePreferences'

export type Panel = 'settings' | 'queue' | 'services' | 'collection' | 'about' | 'updates' | null
const terminal = new Set(['ready', 'partial', 'failed', 'cancelled', 'interrupted', 'expired'])

export function useRemoteMedia() {
  const [preferences, setPreferences] = useState(loadRemotePreferences)
  const [url, setURLState] = useState(''), [inspection, setInspection] = useState<Inspection | null>(null)
  const [caps, setCaps] = useState<Capabilities | null>(null), [jobs, setJobs] = useState<Job[]>([])
  const [panel, setPanel] = useState<Panel>(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [needsChoice, setNeedsChoice] = useState(false)
  const [errorCode, setErrorCode] = useState('UNKNOWN_ERROR')
  const [queueBatch, setQueueBatch] = useState<'retry' | 'clear' | null>(null), [queueBatchStatus, setQueueBatchStatus] = useState('')
  const queueBatchController = useRef<AbortController | null>(null)
  const [deliveryTick, setDeliveryTick] = useState(0)
  const [checking, setChecking] = useState(false)
  const [linkResults, setLinkResults] = useState<LinkResult[]>([]), [addingLinks, setAddingLinks] = useState(false)
  const batchController = useRef<AbortController | null>(null)
  const [discovery, setDiscovery] = useState<Discovery | null>(null), [page, setPage] = useState<Page<Item>>({ items: [], next: null })
  const [selected, setSelected] = useState<Set<string>>(new Set()), [all, setAll] = useState(false), [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState<Mode>('combined')
  const [results, setResults] = useState<{ id: string; page: Page<Item> } | null>(null)
  const resultsRevision = useRef(0)
  const queueLocks = useRef(new Set<string>())
  const [queueBusy, setQueueBusy] = useState(new Set<string>())
  const [limit, setLimit] = useState(1000), [after, setAfter] = useState(''), [before, setBefore] = useState('')
  const lock = useRef(false), edited = useRef(false), controller = useRef<AbortController | null>(null)
  const currentDiscovery = useRef(discovery), cursor = useRef(''), mounted = useRef(true)
  const submissions = useRef(new Map<string, string>())
  const pendingDownloads = useRef(new Set<string>()), attemptedDownloads = useRef(new Set<string>())
  const deliveryAttempts = useRef(new Map<string, number>()), deliveryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const deliveryClickedAt = useRef(new Map<string, number>())
  const deliveryRequests = useRef(new Map<string, Promise<boolean>>())
  const queueRevision = useRef(0), refreshQueue = useRef<() => void>(() => {})
  const currentJobs = useRef(jobs)
  currentJobs.current = jobs
  currentDiscovery.current = discovery
  const activeWork = jobs.some(job => !terminal.has(job.state)) || discovery?.state === 'discovering'
  useEffect(() => { if (activeWork) refreshQueue.current() }, [activeWork])

  const deliver = useCallback((artifactId: string, allowed: () => boolean = () => true) => {
    const existing = deliveryRequests.current.get(artifactId)
    if (existing) return existing
    // Manual and automatic requests for the same file share one browser delivery.
    const request = (async () => {
      const access = await remoteMedia.access(artifactId)
      if (!mounted.current || !allowed()) return false
      const target = new URL(access.url, location.origin)
      const local = access.local === true && target.protocol === 'blob:' && target.origin === location.origin
      if (!local && (!['https:', ...(import.meta.env.DEV ? ['http:'] : [])].includes(target.protocol) || target.username || target.password)) throw new Error('The service returned an invalid download address.')
      const link = document.createElement('a')
      link.href = target.href; link.rel = 'noreferrer'; link.download = access.name
      document.body.append(link); link.click(); link.remove()
      if (local) { remoteMedia.browserDelivered(artifactId); setStatus('Download sent to your browser. If it did not start, use Download again in Recent downloads.') }
      return true
    })()
    deliveryRequests.current.set(artifactId, request)
    const clear = () => { deliveryRequests.current.delete(artifactId) }
    void request.then(clear, clear)
    return request
  }, [])

  useEffect(() => {
    const update = () => setJobs(current => remoteMedia.syncBrowserJobs(current))
    window.addEventListener('mewvi-browser-download', update)
    return () => window.removeEventListener('mewvi-browser-download', update)
  }, [])

  const markDelivery = useCallback((identity: string) => {
    deliveryClickedAt.current.set(identity, Date.now())
    refreshQueue.current()
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
            // Keep an in-flight action's row stable while other jobs continue updating.
            const previous = currentJobs.current
            const items = queue.items.map(job => queueLocks.current.has(job.id) ? previous.find(current => current.id === job.id) || job : job)
            for (const job of previous) if (queueLocks.current.has(job.id) && !items.some(current => current.id === job.id)) items.push(job)
            setJobs(current => JSON.stringify(current) === JSON.stringify(items) ? current : items)
            currentJobs.current = items
          }
          if (!restored) {
            restored = true
            void (async () => {
            const recent = await remoteMedia.discoveries()
            const unfinished = recent.items.find(d => !d.tool && !d.lastJobId && ['discovering', 'ready', 'failed', 'interrupted'].includes(d.state))
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
        const awaitingDelivery = currentJobs.current.some(job => job.artifactId && !job.deliveredAt && Date.now() - (deliveryClickedAt.current.get(`${job.id}:${job.artifactId}`) ?? -Infinity) < 10000)
        const active = awaitingDelivery || currentJobs.current.some(job => !terminal.has(job.state)) || currentDiscovery.current?.state === 'discovering'
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
    return () => { stopped = true; mounted.current = false; clearTimeout(timer); for (const timeout of timers.values()) clearTimeout(timeout); timers.clear(); request.current?.abort(); batchController.current?.abort(); queueBatchController.current?.abort(); window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', visible) }
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
        void deliver(job.artifactId, () => pendingDownloads.current.has(job.id) && currentJobs.current.some(current => current.id === job.id && current.artifactId === job.artifactId && ['ready', 'partial'].includes(current.state))).then(delivered => { if (delivered) markDelivery(identity) }).catch(failure => {
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
            setError('Your file is ready. Use Download file in the queue if it did not start.'); setErrorCode('DOWNLOAD_DELIVERY_FAILED'); setPanel('queue')
          }
        })
      } else if (terminal.has(job.state)) {
        pendingDownloads.current.delete(job.id)
        if (job.state === 'failed') { setError(job.error?.message || 'The download failed. Open the queue for details and retry options.'); setErrorCode(job.error?.code || 'DOWNLOAD_FAILED') }
      }
    }
  }, [jobs, deliver, deliveryTick, markDelivery])
  useEffect(() => { try { localStorage.setItem(REMOTE_PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Optional non-sensitive settings. */ } }, [preferences])

  const action = useCallback(async (work: () => Promise<void>, key?: string) => {
    if (key ? queueLocks.current.has(key) : lock.current) return
    queueRevision.current++
    if (key) { queueLocks.current.add(key); setQueueBusy(new Set(queueLocks.current)) }
    else { lock.current = true; setBusy(true) }
    setError(''); setErrorCode('UNKNOWN_ERROR')
    try { await work() } catch (e) { if (mounted.current) { setError(e instanceof Error ? e.message : 'This operation could not be completed.'); setErrorCode(e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' ? e.code : 'UNKNOWN_ERROR'); setStatus('') } }
    finally {
      queueRevision.current++
      if (key) queueLocks.current.delete(key)
      else lock.current = false
      if (mounted.current) {
        if (key) setQueueBusy(new Set(queueLocks.current))
        else setBusy(false)
        refreshQueue.current()
      }
    }
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
  const submit = (sourceURL = url) => action(async () => {
    const links = splitLinks(sourceURL)
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
      result = await remoteMedia.inspect(links[0] || sourceURL.trim(), check.signal)
      check.signal.throwIfAborted()
    } finally {
      clearTimeout(slow); controller.current = null
      if (mounted.current) setChecking(false)
    }
    if (!mounted.current) return
    setInspection(result)
    if (result.kind !== 'media') {
      setBatchMode(collectionModeFor(preferences, result))
      setPanel('collection'); setStatus('Choose the items you want to download.'); return
    }
    setStatus('Adding your download to the queue…')
    try { await enqueue({ inspectionId: result.id, output: outputFor(preferences, result) }) }
    catch (e) { setNeedsChoice(true); throw e }
  })
  const openPlaylist = () => {
    if (lock.current) return
    const playlist = youtubePlaylistURL(url)
    if (!playlist) return
    setURL(playlist)
    return submit(playlist)
  }
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
  const queueKey = (id: string) => currentJobs.current.find(job => job.artifactId === id)?.id || (results?.page.items.some(item => item.artifactId === id || item.subtitleArtifactId === id) ? results.id : id)
  const download = (id: string) => action(async () => {
    const job = currentJobs.current.find(job => job.id === queueKey(id))
    if (job) attemptedDownloads.current.add(`${job.id}:${id}`)
    const delivered = await deliver(id, () => !job || currentJobs.current.some(current => current.id === job.id))
    if (delivered && job) markDelivery(`${job.id}:${id}`)
  }, queueKey(id))
  const cancel = (id: string) => action(async () => {
    pendingDownloads.current.delete(id)
    const cancelled = await remoteMedia.cancel(id) as Job
    if (mounted.current) setJobs(current => current.map(job => job.id === id ? cancelled : job))
  }, id)
  const retryJob = async (id: string, signal?: AbortSignal) => {
    pendingDownloads.current.delete(id)
    const job = signal ? await batchRequest(() => remoteMedia.retry(id), signal, () => setQueueBatchStatus('The service is busy. Waiting before retrying the next download…')) : await remoteMedia.retry(id)
    if (!mounted.current) return
    if (readInterfacePreferences().autoDownload) pendingDownloads.current.add(id)
    setJobs(current => [job, ...current.filter(j => j.id !== id)])
    resultsRevision.current++; setResults(current => current?.id === id ? null : current)
  }
  const removeJob = async (id: string, signal?: AbortSignal) => {
    pendingDownloads.current.delete(id)
    if (signal) await batchRequest(() => remoteMedia.remove(id), signal, () => setQueueBatchStatus('The service is busy. Waiting before clearing the next entry…'))
    else await remoteMedia.remove(id)
    if (!mounted.current) return
    setJobs(current => current.filter(j => j.id !== id))
    resultsRevision.current++; setResults(current => current?.id === id ? null : current)
  }
  const retry = (id: string) => action(() => retryJob(id), id)
  const remove = (id: string) => action(() => removeJob(id), id)
  const retryableJob = (job: Job) => ['failed', 'partial', 'interrupted'].includes(job.state)
  const recentJob = (job: Job) => ['ready', 'expired'].includes(job.state) && Boolean(job.deliveredAt)
  const queueBatchAction = async (operation: 'retry' | 'clear') => {
    if (queueBatchController.current) return
    const controller = new AbortController(), eligible = operation === 'retry' ? retryableJob : recentJob
    const candidates = currentJobs.current.filter(job => eligible(job) && !queueLocks.current.has(job.id))
    if (!candidates.length) return
    queueBatchController.current = controller; setQueueBatch(operation)
    let completed = 0, failed = 0, skipped = 0
    try {
      for (const [index, job] of candidates.entries()) {
        if (controller.signal.aborted || !mounted.current) break
        if (!currentJobs.current.some(current => current.id === job.id && eligible(current)) || queueLocks.current.has(job.id)) { skipped++; continue }
        setQueueBatchStatus(`${operation === 'retry' ? 'Retrying' : 'Clearing'} ${index + 1} of ${candidates.length}…`)
        let succeeded = false
        await action(async () => { if (operation === 'retry') await retryJob(job.id, controller.signal); else await removeJob(job.id, controller.signal); succeeded = true }, job.id)
        if (succeeded) completed++
        else if (!controller.signal.aborted) failed++
      }
    } finally {
      queueBatchController.current = null
      if (mounted.current) {
        setQueueBatch(null)
        setQueueBatchStatus(`${completed} ${operation === 'retry' ? `download${completed === 1 ? '' : 's'} retried` : `recent ${completed === 1 ? 'entry' : 'entries'} cleared`}.${failed ? ` ${failed} could not be updated.` : ''}${skipped ? ` ${skipped} already changed or busy.` : ''}${controller.signal.aborted ? ' Remaining entries stopped.' : ''}`)
        if (failed) { setError('Some entries could not be updated. Their individual controls are still available.'); setErrorCode('BATCH_FAILED') }
        else if (controller.signal.aborted) setError('')
      }
    }
  }
  const itemResults = (id: string, next = '') => action(async () => {
    const revision = ++resultsRevision.current
    const page = await remoteMedia.items(id, next)
    if (mounted.current && revision === resultsRevision.current) setResults({ id, page })
  }, `items:${id}`)
  const paste = () => action(async () => { setURL(await navigator.clipboard.readText()) })
  const cancelDiscovery = () => action(async () => { if (discovery) setDiscovery(await remoteMedia.cancel(discovery.id, true) as Discovery) })
  return {
    queueJobs: jobs.filter(job => !(['ready','expired'].includes(job.state) && job.deliveredAt)),
    recentJobs: jobs.filter(job => ['ready','expired'].includes(job.state) && job.deliveredAt),
    downloadNeedsAction: new Set(jobs.filter(job => job.artifactId && !job.deliveredAt && (deliveryClickedAt.current.get(`${job.id}:${job.artifactId}`) || Infinity) < Date.now() - 8000).map(job => job.id)),
    preferences, setPreferences, url, setURL, inspection, caps, jobs, panel, setPanel, busy, error, errorCode, status, needsChoice,
    retryableCount: jobs.filter(retryableJob).length, recentCount: jobs.filter(recentJob).length,
    queueBatch, queueBatchStatus, retryFailed: () => queueBatchAction('retry'), clearRecent: () => queueBatchAction('clear'), stopQueueBatch: () => queueBatchController.current?.abort(),
    discovery, page, selected, setSelected, all, setAll, excluded, setExcluded, batchMode, setBatchMode,
    limit, setLimit, after, setAfter, before, setBefore, results,
    setResults: (value: typeof results) => { resultsRevision.current++; setResults(value) },
    queueBusy: (id: string) => queueBusy.has(queueKey(id)), resultsBusy: queueBusy.has(`items:${results?.id}`),
    submit, openPlaylist, paste, discover, createCollection, loadPage, download, cancel, retry, remove, itemResults, cancelDiscovery,
    addToolCollection: (discoveryId: string, itemIds: string[], selection?: {all:boolean;excludedIds:string[]}) => action(async () => { await enqueue({discoveryId,itemIds,all:selection?.all || false,...(selection?{excludedIds:selection.excludedIds}:{}),output:{mode:'combined',container:'original',preset:'best'}}) }),
    cancelCheck: () => controller.current?.abort(), checking, linkResults, addingLinks,
    stopAddingLinks: () => batchController.current?.abort(),
    activeCount: jobs.filter(j => !terminal.has(j.state)).length,
  }
}
export type RemoteController = Omit<ReturnType<typeof useRemoteMedia>, 'setPanel'> & { setPanel: (panel: Panel) => void }
