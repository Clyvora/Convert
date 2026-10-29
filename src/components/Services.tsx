import { useRef, useState } from 'react'
import { remoteMedia } from '../core/mediaClient'

const popular = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Reddit', 'Facebook', 'SoundCloud', 'Vimeo', 'Twitch', 'Pinterest', 'Dailymotion', 'Bluesky', 'Bilibili', 'Tumblr', 'Snapchat', 'Streamable', 'Bandcamp', 'Mixcloud', 'Newgrounds', 'Loom']
export default function Services() {
  const [query, setQuery] = useState(''), [searching, setSearching] = useState(false)
  const [page, setPage] = useState<Awaited<ReturnType<typeof remoteMedia.services>> | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef(0)
  async function search(term: string, cursor = '') {
    const id = ++request.current
    setBusy(true); setError(''); setSearching(true); setQuery(term)
    try { const result = await remoteMedia.services(term, cursor); if (id === request.current) setPage(result) }
    catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : 'The catalog is unavailable. Try again later.') }
    finally { if (id === request.current) setBusy(false) }
  }
  return <div className="services-popover-content">
    <div className="service-chip-list" aria-label="Common providers">{popular.map(name => <button key={name} type="button" onClick={() => { setPage(null); void search(name === 'X / Twitter' ? 'twitter' : name) }} aria-label={`Search ${name}`}>{name}</button>)}</div>
    <p className="services-caption">Availability varies by source.</p>
    {!searching ? <button className="catalog-search-trigger" type="button" onClick={() => setSearching(true)}><span aria-hidden="true">⌕</span> Search all services <span aria-hidden="true">↗</span></button> : <>
      <form className="service-search" onSubmit={e => { e.preventDefault(); void search(query) }}><label>Search services<input autoFocus value={query} placeholder="Find a provider…" onChange={e => { setQuery(e.target.value); setPage(null); ++request.current; setBusy(false) }}/></label><button className="secondary-button" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button></form>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="catalog-results" aria-live="polite">{page?.items.map(s => <article className="service-item" key={s.id}><h3>{s.id}<span className="muted">{s.enabled ? 'enabled' : 'disabled'}</span></h3><p>Downloads: {s.single} · Playlists: {s.playlist} · Profiles: {s.profile}</p></article>)}{page && !page.items.length && <p>No matching services.</p>}</div>
      {page?.next && <button className="text-button" type="button" disabled={busy} onClick={() => void search(query, page.next!)}>More results</button>}
    </>}
  </div>
}
